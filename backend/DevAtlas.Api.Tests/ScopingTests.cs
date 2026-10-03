using System.Net;
using System.Net.Http.Json;
using DevAtlas.Api.Data;
using Microsoft.Extensions.DependencyInjection;

namespace DevAtlas.Api.Tests;

/// <summary>
/// El scoping por UserId es la invariante que sostiene el multi-usuario: si se rompe,
/// un usuario ve o edita el catálogo de otro. Estos tests la fijan.
/// </summary>
public class ScopingTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public ScopingTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    private record AppItem(Guid Id, string Name);

    [Theory]
    [InlineData("/api/applications")]
    [InlineData("/api/clients")]
    [InlineData("/api/environments")]
    [InlineData("/api/applications/stats")]
    [InlineData("/api/backup/export")]
    public async Task Sin_token_devuelve_401(string url)
    {
        var client = _factory.CreateClientFor(null);
        var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Con_token_invalido_devuelve_401()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "no-es-un-token");

        var response = await client.GetAsync("/api/applications");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Cada_usuario_ve_solo_sus_apps()
    {
        var a = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .GetFromJsonAsync<List<AppItem>>("/api/applications");
        var b = await _factory.CreateClientFor(DevAtlasFactory.UserBId)
            .GetFromJsonAsync<List<AppItem>>("/api/applications");

        // Sin asumir orden de ejecución: lo que importa es que ninguno vea lo del otro.
        Assert.Contains(a!, x => x.Name == "App de A");
        Assert.DoesNotContain(a!, x => x.Name is "App de B" or "App demo");

        Assert.Contains(b!, x => x.Name == "App de B");
        Assert.DoesNotContain(b!, x => x.Name is "App de A" or "App demo");
    }

    [Fact]
    public async Task No_se_puede_leer_la_app_de_otro_usuario()
    {
        var appDeB = _factory.PublicIdOf("App de B");
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .GetAsync($"/api/applications/{appDeB}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task No_se_puede_borrar_la_app_de_otro_usuario()
    {
        var appDeB = _factory.PublicIdOf("App de B");
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .DeleteAsync($"/api/applications/{appDeB}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        Assert.True(db.Applications.Any(x => x.Name == "App de B"));
    }

    [Fact]
    public async Task No_se_pueden_tocar_las_urls_de_la_app_de_otro_usuario()
    {
        var appDeB = _factory.PublicIdOf("App de B");
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .PostAsJsonAsync($"/api/applications/{appDeB}/urls", new { environment = "Dev", url = "https://x.test" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task El_workspace_demo_necesita_sesion()
    {
        // Sin token, pedir el workspace demo sigue siendo 401: dejó de ser un fallback anónimo.
        var anon = _factory.CreateClient();
        anon.DefaultRequestHeaders.Add("X-DevAtlas-Workspace", "demo");
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/api/applications")).StatusCode);

        // Con sesión válida, el header sí cambia de workspace.
        var conSesion = _factory.CreateClientFor(DevAtlasFactory.UserAId, demoWorkspace: true);
        var apps = await conSesion.GetFromJsonAsync<List<AppItem>>("/api/applications");
        Assert.Equal(["App demo"], apps!.Select(x => x.Name));
    }

    [Fact]
    public async Task La_app_creada_queda_en_el_workspace_de_quien_la_crea()
    {
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserBId).PostAsJsonAsync("/api/applications", new
        {
            name = "Nueva de B",
            urls = Array.Empty<object>(),
            tags = Array.Empty<string>(),
        });
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        var creada = db.Applications.Single(x => x.Name == "Nueva de B");

        Assert.Equal(DevAtlasFactory.UserBId, creada.UserId);
        Assert.NotEqual(Guid.Empty, creada.PublicId);
    }
}
