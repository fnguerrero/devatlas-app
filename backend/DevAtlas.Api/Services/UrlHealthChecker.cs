using System.Diagnostics;

namespace DevAtlas.Api.Services;

public record UrlHealthResult(int Id, string Status, int? HttpStatus, long ElapsedMs, string? Detail);

/// <summary>
/// Chequeo de vida de las URLs del catálogo. Está pensado para ser barato y no molestar
/// a los servidores de destino: un HEAD, timeout corto, sin redirects y sin reintentos.
/// Nunca corre solo: lo dispara el usuario al abrir una app o con el botón de refresco.
/// </summary>
public sealed class UrlHealthChecker(IHttpClientFactory factory)
{
    public const string HttpClientName = "url-health";

    // Tope de requests en vuelo: una app con muchos ambientes no abre 30 sockets de golpe.
    private static readonly SemaphoreSlim Gate = new(4);

    public async Task<List<UrlHealthResult>> CheckAllAsync(
        IEnumerable<(int Id, string Url)> urls,
        CancellationToken ct)
    {
        var tasks = urls.Select(u => CheckAsync(u.Id, u.Url, ct));
        var results = await Task.WhenAll(tasks);
        return [.. results];
    }

    private async Task<UrlHealthResult> CheckAsync(int id, string url, CancellationToken ct)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return new UrlHealthResult(id, "unknown", null, 0, "No es una URL http(s).");
        }

        await Gate.WaitAsync(ct);
        var sw = Stopwatch.StartNew();
        try
        {
            var client = factory.CreateClient(HttpClientName);
            var response = await SendAsync(client, HttpMethod.Head, uri, ct);

            // Hay servidores que no atienden HEAD y contestan cualquier cosa: 405, 501 o
            // directamente 404 aunque el recurso exista (pasa con el swagger de algunas
            // APIs). Ante esos códigos se reintenta una vez con GET, leyendo sólo los
            // headers para no bajar el cuerpo.
            if (response.StatusCode is System.Net.HttpStatusCode.MethodNotAllowed
                or System.Net.HttpStatusCode.NotImplemented
                or System.Net.HttpStatusCode.NotFound)
            {
                response.Dispose();
                response = await SendAsync(client, HttpMethod.Get, uri, ct);
            }

            sw.Stop();
            using (response)
            {
                var code = (int)response.StatusCode;
                var status = code switch
                {
                    // 3xx cuenta como viva: no se siguen redirects a propósito.
                    < 400 => "up",
                    // Una API no sirve nada en la raíz: 404/401/403 ahí significa que el
                    // servidor está levantado, no que algo ande mal. No es una alerta.
                    401 or 403 or 404 => "reachable",
                    _ => "error",
                };
                return new UrlHealthResult(id, status, code, sw.ElapsedMilliseconds, response.ReasonPhrase);
            }
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            sw.Stop();
            return new UrlHealthResult(id, "down", null, sw.ElapsedMilliseconds, "Timeout.");
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            return new UrlHealthResult(id, "down", null, sw.ElapsedMilliseconds, ex.Message);
        }
        finally
        {
            Gate.Release();
        }
    }

    private static Task<HttpResponseMessage> SendAsync(
        HttpClient client, HttpMethod method, Uri uri, CancellationToken ct) =>
        client.SendAsync(
            new HttpRequestMessage(method, uri),
            HttpCompletionOption.ResponseHeadersRead,
            ct);
}
