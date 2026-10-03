using System.Net.Http.Json;
using DevAtlas.Api.Data;
using Microsoft.Extensions.DependencyInjection;

namespace DevAtlas.Api.Tests;

/// <summary>
/// Export a CSV y frescura del "última edición" de cada app.
/// </summary>
public class ExportAndTimestampTests : IClassFixture<DevAtlasFactory>
{
    private readonly DevAtlasFactory _factory;

    public ExportAndTimestampTests(DevAtlasFactory factory)
    {
        _factory = factory;
        _factory.Seed();
    }

    [Fact]
    public async Task El_csv_trae_una_fila_por_app_visible()
    {
        var response = await _factory.CreateClientFor(DevAtlasFactory.UserAId)
            .GetAsync("/api/applications/export.csv");
        response.EnsureSuccessStatusCode();

        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);

        var texto = await response.Content.ReadAsStringAsync();
        var lineas = texto.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.StartsWith("﻿Nombre,Cliente,Estado", lineas[0]);
        Assert.Contains(lineas, l => l.Contains("\"App de A\""));
        Assert.Contains(lineas, l => l.Contains("\"Acme\""));   // cliente en su columna
        Assert.DoesNotContain(lineas, l => l.Contains("\"Reportes Viejos\""));  // archivada
        Assert.DoesNotContain(lineas, l => l.Contains("\"App de B\""));         // de otro usuario
    }

    [Fact]
    public async Task El_csv_escapa_las_comillas_del_contenido()
    {
        var client = _factory.CreateClientFor(DevAtlasFactory.UserAId);
        await client.PostAsJsonAsync("/api/applications", new
        {
            name = "App \"entrecomillada\"",
            urls = Array.Empty<object>(),
            tags = Array.Empty<string>(),
        });

        var texto = await client.GetStringAsync("/api/applications/export.csv");

        Assert.Contains("\"App \"\"entrecomillada\"\"\"", texto);
    }

    [Fact]
    public async Task Agregar_una_url_actualiza_la_fecha_de_edicion_de_la_app()
    {
        var client = _factory.CreateClientFor(DevAtlasFactory.UserAId);
        var appId = _factory.PublicIdOf("App de A");

        DateTime Editada()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
            return db.Applications.Single(a => a.PublicId == appId).UpdatedAt;
        }

        var antes = Editada();
        await Task.Delay(10);

        var response = await client.PostAsJsonAsync($"/api/applications/{appId}/urls",
            new { environment = "Dev", url = "https://nueva.test" });
        response.EnsureSuccessStatusCode();

        Assert.True(Editada() > antes, "agregar una URL tiene que refrescar UpdatedAt de la app");
    }
}
