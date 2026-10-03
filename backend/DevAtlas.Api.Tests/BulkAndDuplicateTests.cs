using System.Net;
using System.Net.Http.Json;
using DevAtlas.Api.Data;
using Microsoft.Extensions.DependencyInjection;

namespace DevAtlas.Api.Tests;

/// <summary>
/// Duplicar y las acciones masivas tocan varias filas de una: lo que se fija acá es que
/// no se salgan del workspace de quien las pide.
/// </summary>
public class BulkAndDuplicateTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public BulkAndDuplicateTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    private record DetailDto(Guid Id, string Name, string? Stack, bool IsFavorite, bool IsArchived, List<string> Tags);
    private record BulkResult(int Affected, int NotFound);

    [Fact]
    public async Task Duplicar_copia_datos_tags_y_deja_la_copia_como_borrador()
    {
        var client = _factory.CreateClientFor(DevAtlasFactory.UserAId);
        var original = _factory.PublicIdOf("Portal Pedidos");

        var response = await client.PostAsync($"/api/applications/{original}/duplicate", null);
        response.EnsureSuccessStatusCode();

        var copia = await response.Content.ReadFromJsonAsync<DetailDto>();

        Assert.Equal("Portal Pedidos (copia)", copia!.Name);
        Assert.Equal("React", copia.Stack);
        Assert.Equal(["pedidos"], copia.Tags);
        Assert.False(copia.IsFavorite);   // el original sí es favorito
        Assert.NotEqual(original, copia.Id);
    }

    [Fact]
    public async Task No_se_puede_duplicar_la_app_de_otro_usuario()
    {
        var appDeB = _factory.PublicIdOf("App de B");
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .PostAsync($"/api/applications/{appDeB}/duplicate", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Bulk_archiva_varias_de_una()
    {
        var client = _factory.CreateClientFor(DevAtlasFactory.UserAId);
        var ids = new[] { _factory.PublicIdOf("App de A"), _factory.PublicIdOf("Sistema de Pagos") };

        var response = await client.PostAsJsonAsync("/api/applications/bulk", new { ids, action = "archive" });
        var result = await response.Content.ReadFromJsonAsync<BulkResult>();

        Assert.Equal(2, result!.Affected);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        Assert.True(db.Applications.Single(a => a.Name == "Sistema de Pagos").IsArchived);

        // Se deja como estaba para no arrastrar el efecto a los otros tests.
        await client.PostAsJsonAsync("/api/applications/bulk", new { ids, action = "unarchive" });
    }

    [Fact]
    public async Task Bulk_ignora_las_apps_de_otro_usuario_y_las_reporta()
    {
        var ids = new[] { _factory.PublicIdOf("App de A"), _factory.PublicIdOf("App de B") };

        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .PostAsJsonAsync("/api/applications/bulk", new { ids, action = "favorite" });
        var result = await response.Content.ReadFromJsonAsync<BulkResult>();

        Assert.Equal(1, result!.Affected);
        Assert.Equal(1, result.NotFound);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        Assert.False(db.Applications.Single(a => a.Name == "App de B").IsFavorite);
    }

    [Fact]
    public async Task Bulk_con_accion_desconocida_es_400()
    {
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .PostAsJsonAsync("/api/applications/bulk", new { ids = Array.Empty<Guid>(), action = "explotar" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
