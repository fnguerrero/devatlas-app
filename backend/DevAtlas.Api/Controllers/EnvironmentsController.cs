using DevAtlas.Api.Auth;
using DevAtlas.Api.Data;
using DevAtlas.Api.Dtos;
using DevAtlas.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevAtlas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/environments")]
public class EnvironmentsController(DevAtlasContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AppEnvironmentDto>>> GetAll()
    {
        var uid = this.GetUserId();
        var envs = await db.Environments
            .Where(e => e.UserId == uid)
            .OrderBy(e => e.SortOrder).ThenBy(e => e.Name)
            .Select(e => new AppEnvironmentDto(e.Id, e.Name, e.SortOrder, e.Color, e.Urls.Count))
            .ToListAsync();

        return Ok(envs);
    }

    [HttpPost]
    public async Task<ActionResult<AppEnvironmentDto>> Create(UpsertEnvironmentDto dto)
    {
        var uid = this.GetUserId();
        var name = dto.Name.Trim();
        if (await db.Environments.AnyAsync(e => e.UserId == uid && e.Name == name))
        {
            return Conflict($"Ya existe un ambiente llamado '{name}'.");
        }

        var env = new AppEnvironment { Name = name, SortOrder = dto.SortOrder, Color = dto.Color, UserId = uid };
        db.Environments.Add(env);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new AppEnvironmentDto(env.Id, env.Name, env.SortOrder, env.Color, 0));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AppEnvironmentDto>> Update(int id, UpsertEnvironmentDto dto)
    {
        var uid = this.GetUserId();
        var env = await db.Environments.FirstOrDefaultAsync(e => e.Id == id && e.UserId == uid);
        if (env is null) return NotFound();

        var name = dto.Name.Trim();
        if (await db.Environments.AnyAsync(e => e.UserId == uid && e.Id != id && e.Name == name))
        {
            return Conflict($"Ya existe un ambiente llamado '{name}'.");
        }

        env.Name = name;
        env.SortOrder = dto.SortOrder;
        env.Color = dto.Color;
        await db.SaveChangesAsync();

        var urlCount = await db.ApplicationUrls.CountAsync(u => u.EnvironmentId == id);
        return Ok(new AppEnvironmentDto(env.Id, env.Name, env.SortOrder, env.Color, urlCount));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var uid = this.GetUserId();
        var env = await db.Environments.FirstOrDefaultAsync(e => e.Id == id && e.UserId == uid);
        if (env is null) return NotFound();

        var inUse = await db.ApplicationUrls.CountAsync(u => u.EnvironmentId == id);
        if (inUse > 0)
        {
            return Conflict($"No se puede eliminar: hay {inUse} URL(s) usando este ambiente.");
        }

        db.Environments.Remove(env);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
