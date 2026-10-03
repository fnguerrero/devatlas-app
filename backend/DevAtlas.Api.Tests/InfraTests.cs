using System.Net;
using System.Net.Http.Json;

namespace DevAtlas.Api.Tests;

/// <summary>
/// Bordes de infraestructura: salud, forma de los errores y cacheo. No son features,
/// pero son lo que hace que un problema se vea claro en vez de como una pantalla en blanco.
/// </summary>
public class InfraTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public InfraTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    private record HealthDto(string Status, string Database);

    [Fact]
    public async Task Health_responde_sin_token()
    {
        var response = await _factory.CreateClient().GetAsync("/api/health");
        response.EnsureSuccessStatusCode();

        var health = await response.Content.ReadFromJsonAsync<HealthDto>();
        Assert.Equal("ok", health!.Status);
        Assert.Equal("ok", health.Database);
    }

    [Fact]
    public async Task Un_error_no_controlado_sale_como_ProblemDetails_sin_filtrar_el_detalle()
    {
        var response = await _factory.CreateClient().GetAsync("/api/_boom");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var cuerpo = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("secreto interno", cuerpo);
        Assert.DoesNotContain("InvalidOperationException", cuerpo);
    }

    [Fact]
    public async Task Un_body_invalido_sale_como_ProblemDetails_400()
    {
        var client = _factory.CreateClientFor(DevAtlasFactory.UserAId);
        var content = new StringContent("{ esto no es json ", System.Text.Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/applications", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [InlineData("/api/applications/tags")]
    [InlineData("/api/applications/stats")]
    public async Task Los_datos_de_resumen_se_cachean_en_privado(string url)
    {
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId).GetAsync(url);
        response.EnsureSuccessStatusCode();

        var cache = response.Headers.CacheControl;
        Assert.True(cache!.Private);
        Assert.Equal(TimeSpan.FromSeconds(30), cache.MaxAge);
    }
}
