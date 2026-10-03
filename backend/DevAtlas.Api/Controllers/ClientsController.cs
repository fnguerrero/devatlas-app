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
[Route("api/clients")]
public class ClientsController(DevAtlasContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ClientDto>>> GetAll()
    {
        var uid = this.GetUserId();
        var clients = await db.Clients
            .Where(c => c.UserId == uid)
            .OrderBy(c => c.Name)
            .Select(c => new ClientDto(c.Id, c.Name, c.Color, c.Applications.Count(a => !a.IsArchived), c.IsHidden))
            .ToListAsync();

        return Ok(clients);
    }

    [HttpPost]
    public async Task<ActionResult<ClientDto>> Create(UpsertClientDto dto)
    {
        var uid = this.GetUserId();
        var name = dto.Name.Trim();
        if (await db.Clients.AnyAsync(c => c.UserId == uid && c.Name == name))
        {
            return Conflict($"Ya existe un cliente llamado '{name}'.");
        }

        var client = new Client { Name = name, Color = dto.Color, UserId = uid, IsHidden = dto.IsHidden };
        db.Clients.Add(client);
        await db.SaveChangesAsync();
        return Ok(new ClientDto(client.Id, client.Name, client.Color, 0, client.IsHidden));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var uid = this.GetUserId();
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.UserId == uid);
        if (client is null) return NotFound();

        // Las apps asociadas quedan sin cliente (FK con OnDelete: SetNull).
        db.Clients.Remove(client);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ClientDto>> Update(int id, UpsertClientDto dto)
    {
        var uid = this.GetUserId();
        var client = await db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.UserId == uid);
        if (client is null) return NotFound();

        var name = dto.Name.Trim();
        if (await db.Clients.AnyAsync(c => c.UserId == uid && c.Id != id && c.Name == name))
        {
            return Conflict($"Ya existe un cliente llamado '{name}'.");
        }

        client.Name = name;
        client.Color = dto.Color;
        client.IsHidden = dto.IsHidden;
        await db.SaveChangesAsync();

        var appCount = await db.Applications.CountAsync(a => a.ClientId == id && !a.IsArchived);
        return Ok(new ClientDto(client.Id, client.Name, client.Color, appCount, client.IsHidden));
    }
}
