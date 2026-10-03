using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DevAtlas.Api.Data;
using DevAtlas.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace DevAtlas.Api.Tests;

/// <summary>
/// Levanta la API real contra una SQLite en memoria, con dos usuarios y sus apps.
/// La conexión se mantiene abierta: al cerrarla, SQLite descarta la base entera.
/// </summary>
public class DevAtlasFactory : WebApplicationFactory<Program>
{
    private const string TestJwtKey = "clave-de-test-solo-para-los-tests-de-integracion-32b";
    private const string TestIssuer = "DevAtlas";

    private SqliteConnection? _connection;

    // Program.cs lee Jwt:Key durante el arranque, antes de que WebApplicationFactory
    // pueda inyectar fuentes de configuración. Las variables de entorno sí llegan a tiempo.
    static DevAtlasFactory()
    {
        Environment.SetEnvironmentVariable("Jwt__Key", TestJwtKey);
        Environment.SetEnvironmentVariable("Jwt__Issuer", TestIssuer);
        Environment.SetEnvironmentVariable("Google__ClientId", "test-client-id");
    }

    public const int UserAId = 2;
    public const int UserBId = 3;
    public const int DemoUserId = 1;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = TestJwtKey,
                ["Jwt:Issuer"] = TestIssuer,
                ["Google:ClientId"] = "test-client-id",
            });
        });

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<DevAtlasContext>));
            if (descriptor is not null) services.Remove(descriptor);

            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            services.AddDbContext<DevAtlasContext>(options => options.UseSqlite(_connection));
        });
    }

    private readonly Lock _seedGate = new();
    private bool _seeded;

    /// <summary>
    /// Crea las tablas y siembra dos workspaces distintos. La factory se comparte entre
    /// todos los tests de la clase, así que sólo siembra la primera vez.
    /// </summary>
    public void Seed()
    {
        lock (_seedGate)
        {
            if (_seeded) return;
            _seeded = true;
            SeedCore();
        }
    }

    private void SeedCore()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        db.Database.EnsureCreated();

        db.Users.AddRange(
            new User { Id = UserAId, GoogleId = "google-a", Email = "a@test.local", Name = "Usuario A" },
            new User { Id = UserBId, GoogleId = "google-b", Email = "b@test.local", Name = "Usuario B" });

        // Catálogo de A con variedad suficiente para ejercitar todos los filtros:
        // cliente visible y oculto, tags, estados, capas, externas y archivadas.
        var acme = new Client { UserId = UserAId, Name = "Acme", Color = "#7c3aed" };
        var clienteOculto = new Client { UserId = UserAId, Name = "Cliente Viejo", Color = "#6b7280", IsHidden = true };
        db.Clients.AddRange(acme, clienteOculto);

        var tagPedidos = new Tag { UserId = UserAId, Name = "pedidos" };
        var tagInterno = new Tag { UserId = UserAId, Name = "interno" };
        db.Tags.AddRange(tagPedidos, tagInterno);

        db.Applications.AddRange(
            new Application
            {
                UserId = UserAId,
                Name = "App de A",
                Stack = ".NET",
                Layer = "backend",
                Owner = "Seba",
                Notes = "Corre en la torre de casa.",
            },
            new Application
            {
                UserId = UserAId,
                Name = "Portal Pedidos",
                Stack = "React",
                Layer = "frontend",
                Owner = "Ana",
                Client = acme,
                Status = "paused",
                IsFavorite = true,
                ApplicationTags = [new ApplicationTag { Tag = tagPedidos }],
            },
            new Application
            {
                UserId = UserAId,
                Name = "Legacy VB",
                Stack = "VB6",
                Status = "deprecated",
                ApplicationTags = [new ApplicationTag { Tag = tagInterno }],
            },
            new Application { UserId = UserAId, Name = "Sistema de Pagos", IsExternal = true, Layer = "backend" },
            new Application { UserId = UserAId, Name = "Reportes Viejos", IsArchived = true },
            new Application { UserId = UserAId, Name = "App Del Cliente Oculto", Client = clienteOculto },
            new Application { UserId = UserBId, Name = "App de B", Stack = "React", Layer = "frontend" },
            new Application { UserId = DemoUserId, Name = "App demo" });

        db.SaveChanges();
    }

    public int ClientIdOf(string clientName)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        return db.Clients.Single(c => c.Name == clientName).Id;
    }

    public Guid PublicIdOf(string appName)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
        return db.Applications.Single(a => a.Name == appName).PublicId;
    }

    public HttpClient CreateClientFor(int? userId, bool demoWorkspace = false)
    {
        var client = CreateClient();
        if (userId is int uid)
        {
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", TokenFor(uid));
        }
        if (demoWorkspace)
        {
            client.DefaultRequestHeaders.Add("X-DevAtlas-Workspace", "demo");
        }
        return client;
    }

    private static string TokenFor(int userId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtKey));
        var token = new JwtSecurityToken(
            issuer: TestIssuer,
            claims: [new Claim("uid", userId.ToString())],
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection?.Dispose();
            _connection = null;
        }
    }
}
