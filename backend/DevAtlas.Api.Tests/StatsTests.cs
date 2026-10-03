using System.Net.Http.Json;

namespace DevAtlas.Api.Tests;

/// <summary>
/// El resumen del listado se calcula con agregaciones en la base; estos tests fijan los
/// números contra el seed para que una optimización no cambie lo que se muestra.
/// </summary>
public class StatsTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public StatsTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    private record NameCountDto(string Name, int Count);

    private record StatsResponse(
        int Total,
        int Favorites,
        int Archived,
        int DistinctStacks,
        int DistinctTags,
        List<NameCountDto> ByStack,
        List<NameCountDto> TopTags);

    private Task<StatsResponse?> Stats() => _factory.CreateClientFor(DevAtlasFactory.UserAId)
        .GetFromJsonAsync<StatsResponse>("/api/applications/stats");

    [Fact]
    public async Task Cuenta_activas_favoritas_y_archivadas_del_usuario()
    {
        var stats = (await Stats())!;

        // El seed de A: 6 apps, una archivada; una sola favorita.
        Assert.Equal(5, stats.Total);
        Assert.Equal(1, stats.Favorites);
        Assert.Equal(1, stats.Archived);
    }

    [Fact]
    public async Task Agrupa_stacks_y_tags_sin_contar_las_archivadas()
    {
        var stats = (await Stats())!;

        Assert.Equal(3, stats.DistinctStacks);           // .NET, React, VB6
        Assert.Contains(stats.ByStack, s => s.Name == ".NET" && s.Count == 1);
        Assert.Equal(2, stats.DistinctTags);             // pedidos, interno
        Assert.Contains(stats.TopTags, t => t.Name == "pedidos" && t.Count == 1);
    }

    [Fact]
    public async Task Las_stats_son_por_usuario()
    {
        var deB = await _factory.CreateClientFor(DevAtlasFactory.UserBId)
            .GetFromJsonAsync<StatsResponse>("/api/applications/stats");

        Assert.Equal(1, deB!.Total);
        Assert.Equal(0, deB.Archived);
    }
}
