using DevAtlas.Api.Auth;
using DevAtlas.Api.Data;
using DevAtlas.Api.Dtos;
using DevAtlas.Api.Models;
using DevAtlas.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevAtlas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/applications/{appId:guid}/urls")]
public class UrlsController(DevAtlasContext db) : ControllerBase
{
    // Traduce el id público (Guid) al id interno, validando de paso que la app
    // sea del workspace actual. null = no existe o no es tuya.
    private async Task<int?> ResolveAppIdAsync(Guid appId)
    {
        var uid = this.GetUserId();
        return await db.Applications
            .Where(a => a.PublicId == appId && a.UserId == uid)
            .Select(a => (int?)a.Id)
            .FirstOrDefaultAsync();
    }

    // Cambiar una URL es cambiar la app: si no, "última edición" ordena por una fecha
    // que se quedó en la última vez que se tocó el formulario.
    private async Task TocarAppAsync(int appId)
    {
        var app = await db.Applications.FirstAsync(a => a.Id == appId);
        app.UpdatedAt = DateTime.UtcNow;
    }

    // Chequeo de vida de las URLs de la app. Se dispara a pedido (al abrir el detalle o
    // con el botón de refresco), nunca en background ni en intervalos.
    [HttpGet("health")]
    public async Task<ActionResult<List<UrlHealthResult>>> Health(
        Guid appId,
        [FromServices] UrlHealthChecker checker,
        CancellationToken ct)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();

        var urls = await db.ApplicationUrls
            .Where(u => u.ApplicationId == internalAppId)
            .Select(u => new { u.Id, u.Url })
            .ToListAsync(ct);

        var results = await checker.CheckAllAsync(urls.Select(u => (u.Id, u.Url)), ct);
        return Ok(results);
    }

    [HttpPost]
    public async Task<ActionResult<ApplicationUrlDto>> Create(Guid appId, ApplicationUrlInput dto)
    {
        if (await ResolveAppIdAsync(appId) is not int id) return NotFound();

        var env = await ResolveEnvironmentAsync(dto.Environment);
        var url = new ApplicationUrl { ApplicationId = id, Environment = env, Url = dto.Url.Trim() };
        db.ApplicationUrls.Add(url);
        await TocarAppAsync(id);
        await db.SaveChangesAsync();

        return Ok(new ApplicationUrlDto(url.Id, env.Name, env.Color, url.Url));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApplicationUrlDto>> Update(Guid appId, int id, ApplicationUrlInput dto)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();
        var url = await db.ApplicationUrls
            .Include(u => u.Environment)
            .FirstOrDefaultAsync(u => u.Id == id && u.ApplicationId == internalAppId);
        if (url is null) return NotFound();

        url.Environment = await ResolveEnvironmentAsync(dto.Environment);
        url.Url = dto.Url.Trim();
        await TocarAppAsync(internalAppId);
        await db.SaveChangesAsync();

        return Ok(new ApplicationUrlDto(url.Id, url.Environment!.Name, url.Environment.Color, url.Url));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(Guid appId, int id)
    {
        if (await ResolveAppIdAsync(appId) is not int internalAppId) return NotFound();
        var url = await db.ApplicationUrls.FirstOrDefaultAsync(u => u.Id == id && u.ApplicationId == internalAppId);
        if (url is null) return NotFound();

        db.ApplicationUrls.Remove(url);
        await TocarAppAsync(internalAppId);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<AppEnvironment> ResolveEnvironmentAsync(string name)
    {
        var n = name.Trim();
        var uid = this.GetUserId();
        var envs = await db.Environments.Where(e => e.UserId == uid).ToListAsync();
        var env = envs.FirstOrDefault(e => string.Equals(e.Name, n, StringComparison.OrdinalIgnoreCase));
        if (env is null)
        {
            var nextOrder = envs.Count == 0 ? 1 : envs.Max(e => e.SortOrder) + 1;
            env = new AppEnvironment { Name = n, SortOrder = nextOrder, Color = "#6b7280", UserId = uid };
            db.Environments.Add(env);
        }
        return env;
    }
}
