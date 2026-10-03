using System.Text;
using DevAtlas.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using DevAtlas.Api.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Todos los errores salen en formato ProblemDetails, así el front tiene una sola forma
// que interpretar. El detalle interno (stack, tipo de excepción) nunca viaja al cliente.
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Instance = ctx.HttpContext.Request.Path;
        ctx.ProblemDetails.Extensions.Remove("exception");
    };
});

// Las respuestas del catálogo son JSON repetitivo y comprimen muy bien.
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

builder.Services.AddDbContext<DevAtlasContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DevAtlas")));

// Cifrado de secretos (passwords de conexión). El key ring se persiste en ./keys, al lado
// del .db, para que las passwords sigan siendo descifrables si se mueve la app de máquina.
// Esa carpeta es tan sensible como la base: va gitignoreada y hay que respaldarla junto al .db.
var keysPath = Path.Combine(builder.Environment.ContentRootPath, "keys");
Directory.CreateDirectory(keysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keysPath))
    .SetApplicationName("DevAtlas");

// Clave de firma del JWT: vive en user-secrets (dotnet user-secrets), nunca en appsettings.
// Si falta, la app no arranca en lugar de firmar con una clave débil o predecible.
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Falta Jwt:Key o es demasiado corta (mínimo 32 bytes). Configurala con: " +
        "dotnet user-secrets set \"Jwt:Key\" \"<clave>\" --project backend/DevAtlas.Api");
}

// Autenticación por JWT propio (emitido tras validar el login de Google).
// Todos los controllers de datos exigen [Authorize]: sin token válido, 401.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = false,
            ValidateLifetime = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });

// Cliente del chequeo de URLs: timeout corto y sin seguir redirects, para que un destino
// lento o un bucle de redirecciones no tenga forma de colgar la app.
builder.Services.AddHttpClient(UrlHealthChecker.HttpClientName, client =>
    {
        client.Timeout = TimeSpan.FromSeconds(3);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("DevAtlas-HealthCheck/1.0");
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddSingleton<UrlHealthChecker>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DevAtlasContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Una excepción no controlada sale como ProblemDetails 500 y queda en el log del server,
// en vez de devolverle el stack trace a quien haya llamado.
app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseResponseCompression();
app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

// Chequeo de vida: sirve para saber si la API está arriba y si llega a la base sin
// necesidad de estar logueado.
app.MapGet("/api/health", async (DevAtlasContext db) =>
{
    var baseOk = await db.Database.CanConnectAsync();
    return baseOk
        ? Results.Ok(new { status = "ok", database = "ok" })
        : Results.Json(new { status = "degraded", database = "unreachable" }, statusCode: 503);
}).AllowAnonymous();

// Sólo en los tests: endpoint que revienta a propósito, para verificar que el manejo
// global de errores no filtra el detalle de la excepción.
if (app.Environment.EnvironmentName == "Testing")
{
    app.MapGet("/api/_boom", () => { throw new InvalidOperationException("secreto interno"); })
        .AllowAnonymous();
}

app.MapControllers();

app.Run();

// Visible para WebApplicationFactory en el proyecto de tests.
public partial class Program;
