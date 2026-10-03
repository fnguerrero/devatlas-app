using System.Net.Http.Json;

namespace DevAtlas.Api.Tests;

/// <summary>
/// Filtros y búsqueda del listado: es la vía por la que se entra al catálogo todos los
/// días, así que cada filtro tiene que acotar exactamente lo que dice acotar.
/// </summary>
public class FilterTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public FilterTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    private record AppItem(Guid Id, string Name, string Status, bool IsFavorite, string? Layer, bool IsExternal);

    private async Task<List<string>> Nombres(string url)
    {
        var items = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .GetFromJsonAsync<List<AppItem>>(url);
        return items!.Select(i => i.Name).ToList();
    }

    [Fact]
    public async Task Busca_por_responsable()
    {
        Assert.Equal(["App de A"], await Nombres("/api/applications?search=seba"));
    }

    [Fact]
    public async Task Busca_por_tag_y_por_cliente()
    {
        Assert.Equal(["Portal Pedidos"], await Nombres("/api/applications?search=pedidos"));
        Assert.Equal(["Portal Pedidos"], await Nombres("/api/applications?search=acme"));
    }

    [Fact]
    public async Task Busca_dentro_de_las_notas()
    {
        Assert.Equal(["App de A"], await Nombres("/api/applications?search=torre"));
    }

    [Fact]
    public async Task La_vista_principal_esconde_archivadas_deprecadas_y_clientes_ocultos()
    {
        var visibles = await Nombres("/api/applications");

        Assert.DoesNotContain("Reportes Viejos", visibles);      // archivada
        Assert.DoesNotContain("Legacy VB", visibles);            // deprecada
        Assert.DoesNotContain("App Del Cliente Oculto", visibles); // cliente oculto
        Assert.Contains("App de A", visibles);
    }

    [Fact]
    public async Task Ver_ocultas_las_trae_a_todas()
    {
        var todas = await Nombres("/api/applications?includeHidden=true");

        Assert.Contains("Reportes Viejos", todas);
        Assert.Contains("Legacy VB", todas);
        Assert.Contains("App Del Cliente Oculto", todas);
    }

    [Fact]
    public async Task Filtra_por_capa()
    {
        var backend = await Nombres("/api/applications?layer=backend");

        Assert.Contains("App de A", backend);
        Assert.Contains("Sistema de Pagos", backend);
        Assert.DoesNotContain("Portal Pedidos", backend);
    }

    [Fact]
    public async Task Filtra_por_origen()
    {
        Assert.Equal(["Sistema de Pagos"], await Nombres("/api/applications?origin=external"));
        Assert.DoesNotContain("Sistema de Pagos", await Nombres("/api/applications?origin=own"));
    }

    [Fact]
    public async Task Filtra_por_cliente()
    {
        var acmeId = _factory.ClientIdOf("Acme");
        Assert.Equal(["Portal Pedidos"], await Nombres($"/api/applications?clientId={acmeId}"));
    }

    [Fact]
    public async Task Filtra_por_estado_aunque_ese_estado_este_oculto_por_defecto()
    {
        // "deprecated" no sale en la vista principal, pero pedirlo explícitamente sí lo trae.
        Assert.Equal(["Legacy VB"], await Nombres("/api/applications?status=deprecated"));
        Assert.Equal(["Portal Pedidos"], await Nombres("/api/applications?status=paused"));
    }

    [Fact]
    public async Task Un_estado_inventado_no_vacia_el_listado()
    {
        Assert.NotEmpty(await Nombres("/api/applications?status=chirimbolo"));
    }

    [Fact]
    public async Task Filtra_por_favoritos()
    {
        Assert.Equal(["Portal Pedidos"], await Nombres("/api/applications?favorite=true"));
    }

    [Fact]
    public async Task Los_favoritos_van_primero()
    {
        var nombres = await Nombres("/api/applications");
        Assert.Equal("Portal Pedidos", nombres[0]);
    }
}
