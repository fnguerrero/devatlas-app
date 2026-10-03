using System.Net;
using System.Net.Http.Json;

namespace DevAtlas.Api.Tests;

/// <summary>
/// Lo que entra por la API tiene que quedar bien guardado o ser rechazado con un motivo
/// legible. Guardar en silencio algo distinto de lo pedido es peor que fallar.
/// </summary>
public class ValidationTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public ValidationTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    private static object AppPayload(object? extra = null)
    {
        var basePayload = new Dictionary<string, object?>
        {
            ["name"] = "App de prueba",
            ["urls"] = Array.Empty<object>(),
            ["tags"] = Array.Empty<string>(),
        };

        if (extra is not null)
        {
            foreach (var prop in extra.GetType().GetProperties())
            {
                basePayload[prop.Name] = prop.GetValue(extra);
            }
        }

        return basePayload;
    }

    private HttpClient Client => _factory.CreateClientFor(DevAtlasFactory.UserAId);

    [Fact]
    public async Task Una_url_que_no_es_url_se_rechaza()
    {
        var payload = AppPayload(new
        {
            urls = new[] { new { environment = "Dev", url = "no-es-una-url" } },
        });

        var response = await Client.PostAsJsonAsync("/api/applications", payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("http", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Una_url_valida_se_acepta()
    {
        var payload = AppPayload(new
        {
            name = "Con URL buena",
            urls = new[] { new { environment = "Dev", url = "https://devatlas.test/panel" } },
        });

        var response = await Client.PostAsJsonAsync("/api/applications", payload);
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Un_estado_inventado_se_rechaza_al_guardar()
    {
        var response = await Client.PostAsJsonAsync("/api/applications", AppPayload(new { status = "chirimbolo" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("chirimbolo", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Una_capa_inventada_se_rechaza_al_guardar()
    {
        var response = await Client.PostAsJsonAsync("/api/applications", AppPayload(new { layer = "middleware" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Un_nombre_vacio_se_rechaza()
    {
        var response = await Client.PostAsJsonAsync("/api/applications", AppPayload(new { name = "" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
