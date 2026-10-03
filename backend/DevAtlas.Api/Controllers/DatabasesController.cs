using DevAtlas.Api.Auth;
using DevAtlas.Api.Data;
using DevAtlas.Api.Dtos;
using DevAtlas.Api.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevAtlas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/applications/{appId:guid}/databases")]
public class DatabasesController : ControllerBase
{
    private readonly DevAtlasContext _db;
    private readonly IDataProtector _protector;
    private readonly ILogger<DatabasesController> _logger;

    public DatabasesController(
        DevAtlasContext db,
        IDataProtectionProvider provider,
        ILogger<DatabasesController> logger)
    {
        _db = db;
        _protector = provider.CreateProtector("DevAtlas.DbPasswords");
        _logger = logger;
    }

    // Traduce el id público (Guid) al id interno, validando de paso que la app
    // sea del workspace actual. null = no existe o no es tuya.
    private async Task<int?> ResolveAppIdAsync(Guid appId)
    {
        var uid = this.GetUserId();
        return await _db.Applications
            .Where(a => a.PublicId == appId && a.UserId == uid)
            .Select(a => (int?)a.Id)
            .FirstOrDefaultAsync();
    }

    // Tocar una conexión es tocar la app: mantiene coherente el orden por última edición.
    private async Task TocarAppAsync(int appId)
    {
        var app = await _db.Applications.FirstAsync(a => a.Id == appId);
        app.UpdatedAt = DateTime.UtcNow;
    }

    [HttpPost]
    public async Task<ActionResult<DatabaseConnectionDto>> Create(Guid appId, UpsertDatabaseConnectionDto dto)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();

        var env = await ResolveEnvironmentAsync(dto.Environment);
        var conn = new DatabaseConnection
        {
            ApplicationId = internalAppId,
            Environment = env,
            Engine = dto.Engine.Trim(),
            Host = dto.Host,
            Port = dto.Port,
            DatabaseName = dto.DatabaseName,
            Username = dto.Username,
            SecretRef = dto.SecretRef,
            PasswordEncrypted = string.IsNullOrEmpty(dto.Password) ? null : _protector.Protect(dto.Password),
        };

        _db.DatabaseConnections.Add(conn);
        await TocarAppAsync(internalAppId);
        await _db.SaveChangesAsync();
        return Ok(ToDto(conn));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DatabaseConnectionDto>> Update(Guid appId, int id, UpsertDatabaseConnectionDto dto)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();
        var conn = await _db.DatabaseConnections
            .Include(d => d.Environment)
            .FirstOrDefaultAsync(d => d.Id == id && d.ApplicationId == internalAppId);
        if (conn is null) return NotFound();

        conn.Environment = await ResolveEnvironmentAsync(dto.Environment);
        conn.Engine = dto.Engine.Trim();
        conn.Host = dto.Host;
        conn.Port = dto.Port;
        conn.DatabaseName = dto.DatabaseName;
        conn.Username = dto.Username;
        conn.SecretRef = dto.SecretRef;

        // Password: nueva -> recifrar; ClearPassword -> borrar; vacío -> conservar la existente.
        if (!string.IsNullOrEmpty(dto.Password))
        {
            conn.PasswordEncrypted = _protector.Protect(dto.Password);
        }
        else if (dto.ClearPassword)
        {
            conn.PasswordEncrypted = null;
        }

        await TocarAppAsync(internalAppId);
        await _db.SaveChangesAsync();
        return Ok(ToDto(conn));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(Guid appId, int id)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();
        var conn = await _db.DatabaseConnections.FirstOrDefaultAsync(d => d.Id == id && d.ApplicationId == internalAppId);
        if (conn is null) return NotFound();

        _db.DatabaseConnections.Remove(conn);
        await TocarAppAsync(internalAppId);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Devuelve la password en claro sólo bajo pedido explícito (botón "revelar").
    [HttpGet("{id:int}/reveal")]
    public async Task<ActionResult<object>> Reveal(Guid appId, int id)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();
        var conn = await _db.DatabaseConnections.FirstOrDefaultAsync(d => d.Id == id && d.ApplicationId == internalAppId);
        if (conn is null) return NotFound();
        if (string.IsNullOrEmpty(conn.PasswordEncrypted)) return Ok(new { password = (string?)null });

        // Se deja rastro de cada lectura de credencial en claro (quién, qué conexión, cuándo).
        _logger.LogWarning(
            "Password revelada: usuario {UserId}, workspace {WorkspaceId}, conexión {ConnectionId} ({Engine}@{Host}/{Database}), app {AppId}.",
            User.GetRealUserId(), this.GetUserId(), conn.Id, conn.Engine, conn.Host, conn.DatabaseName, appId);

        try
        {
            return Ok(new { password = _protector.Unprotect(conn.PasswordEncrypted) });
        }
        catch (Exception)
        {
            // La clave de Data Protection cambió o el dato está corrupto.
            return Problem("No se pudo descifrar la contraseña (la clave de cifrado cambió).");
        }
    }

    private async Task<AppEnvironment> ResolveEnvironmentAsync(string name)
    {
        var n = name.Trim();
        var uid = this.GetUserId();
        var envs = await _db.Environments.Where(e => e.UserId == uid).ToListAsync();
        var env = envs.FirstOrDefault(e => string.Equals(e.Name, n, StringComparison.OrdinalIgnoreCase));
        if (env is null)
        {
            var nextOrder = envs.Count == 0 ? 1 : envs.Max(e => e.SortOrder) + 1;
            env = new AppEnvironment { Name = n, SortOrder = nextOrder, Color = "#6b7280", UserId = uid };
            _db.Environments.Add(env);
        }
        return env;
    }

    private static DatabaseConnectionDto ToDto(DatabaseConnection d) => new(
        d.Id,
        d.Environment!.Name,
        d.Environment.Color,
        d.Engine,
        d.Host,
        d.Port,
        d.DatabaseName,
        d.Username,
        !string.IsNullOrEmpty(d.PasswordEncrypted),
        d.SecretRef);
}
