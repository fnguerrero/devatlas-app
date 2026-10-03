using DevAtlas.Api.Auth;
using DevAtlas.Api.Data;
using DevAtlas.Api.Dtos;
using DevAtlas.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevAtlas.Api.Controllers;

/// <summary>
/// Export/import del workspace completo. Es el backup real del catálogo: la base es un
/// archivo SQLite gitignoreado, así que sin esto la única copia es acordarse de copiar el .db.
/// </summary>
[ApiController]
[Authorize]
[Route("api/backup")]
public class BackupController(DevAtlasContext db, ILogger<BackupController> logger) : ControllerBase
{
    public const int FormatVersion = 1;

    [HttpGet("export")]
    public async Task<ActionResult<BackupFile>> Export()
    {
        var uid = this.GetUserId();

        var apps = await db.Applications
            .Where(a => a.UserId == uid)
            .Include(a => a.Client)
            .Include(a => a.Urls).ThenInclude(u => u.Environment)
            .Include(a => a.Databases).ThenInclude(d => d.Environment)
            .Include(a => a.ApplicationTags).ThenInclude(at => at.Tag)
            .OrderBy(a => a.Name)
            .ToListAsync();

        var environments = await db.Environments
            .Where(e => e.UserId == uid)
            .OrderBy(e => e.SortOrder)
            .Select(e => new BackupEnvironment(e.Name, e.SortOrder, e.Color))
            .ToListAsync();

        var clients = await db.Clients
            .Where(c => c.UserId == uid)
            .OrderBy(c => c.Name)
            .Select(c => new BackupClient(c.Name, c.Color))
            .ToListAsync();

        var user = await db.Users.FindAsync(uid);

        var file = new BackupFile(
            FormatVersion,
            DateTime.UtcNow,
            user?.Email,
            environments,
            clients,
            [.. apps.Select(a => new BackupApplication(
                a.Name,
                a.Description,
                a.RepoPath,
                a.Stack,
                a.Notes,
                a.Owner,
                a.Layer,
                a.IsExternal,
                a.Status,
                a.Client?.Name,
                a.IsFavorite,
                a.IsArchived,
                a.CreatedAt,
                a.UpdatedAt,
                [.. a.ApplicationTags.Select(at => at.Tag!.Name)],
                [.. a.Urls.Select(u => new BackupUrl(u.Environment!.Name, u.Url))],
                [.. a.Databases.Select(d => new BackupDatabase(
                    d.Environment!.Name,
                    d.Engine,
                    d.Host,
                    d.Port,
                    d.DatabaseName,
                    d.Username,
                    d.SecretRef,
                    d.PasswordEncrypted))]))]);

        return Ok(file);
    }

    [HttpPost("import")]
    public async Task<ActionResult<ImportResultDto>> Import(ImportRequest request)
    {
        var backup = request.Backup;
        if (backup.Version > FormatVersion)
        {
            return BadRequest($"El backup es de una versión más nueva ({backup.Version}) que la que entiende esta app ({FormatVersion}).");
        }

        var uid = this.GetUserId();
        var replace = string.Equals(request.Mode, "replace", StringComparison.OrdinalIgnoreCase);

        await using var tx = await db.Database.BeginTransactionAsync();

        if (replace)
        {
            // Las URLs, conexiones y tags de cada app se van en cascada.
            var existing = await db.Applications.Where(a => a.UserId == uid).ToListAsync();
            db.Applications.RemoveRange(existing);
            await db.SaveChangesAsync();
            logger.LogWarning("Import en modo replace: se borraron {Count} apps del workspace {UserId}.", existing.Count, uid);
        }

        var environments = await db.Environments.Where(e => e.UserId == uid).ToListAsync();
        var clients = await db.Clients.Where(c => c.UserId == uid).ToListAsync();
        var tags = await db.Tags.Where(t => t.UserId == uid).ToListAsync();
        var appNames = await db.Applications
            .Where(a => a.UserId == uid)
            .Select(a => a.Name)
            .ToListAsync();
        var existingNames = appNames.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var envsCreated = 0;
        var clientsCreated = 0;

        AppEnvironment ResolveEnvironment(string name, int? sortOrder = null, string? color = null)
        {
            var n = name.Trim();
            var env = environments.FirstOrDefault(e => string.Equals(e.Name, n, StringComparison.OrdinalIgnoreCase));
            if (env is null)
            {
                env = new AppEnvironment
                {
                    UserId = uid,
                    Name = n,
                    SortOrder = sortOrder ?? (environments.Count == 0 ? 1 : environments.Max(e => e.SortOrder) + 1),
                    Color = color ?? "#6b7280",
                };
                db.Environments.Add(env);
                environments.Add(env);
                envsCreated++;
            }
            return env;
        }

        Client? ResolveClient(string? name, string? color = null)
        {
            var n = name?.Trim();
            if (string.IsNullOrEmpty(n)) return null;

            var client = clients.FirstOrDefault(c => string.Equals(c.Name, n, StringComparison.OrdinalIgnoreCase));
            if (client is null)
            {
                client = new Client
                {
                    UserId = uid,
                    Name = n,
                    Color = color ?? ClientPalette.NextFree(clients.Select(c => c.Color)),
                };
                db.Clients.Add(client);
                clients.Add(client);
                clientsCreated++;
            }
            return client;
        }

        foreach (var e in backup.Environments) ResolveEnvironment(e.Name, e.SortOrder, e.Color);
        foreach (var c in backup.Clients) ResolveClient(c.Name, c.Color);

        var created = 0;
        var skipped = 0;

        foreach (var a in backup.Applications)
        {
            var name = a.Name.Trim();
            if (name.Length == 0) continue;

            // En merge no se pisa lo que ya está: el import agrega, no sobrescribe.
            if (existingNames.Contains(name))
            {
                skipped++;
                continue;
            }

            var app = new Application
            {
                UserId = uid,
                Name = name,
                Description = a.Description,
                RepoPath = a.RepoPath,
                Stack = a.Stack,
                Notes = a.Notes,
                Owner = a.Owner,
                Layer = a.Layer,
                IsExternal = a.IsExternal,
                Status = a.Status,
                IsFavorite = a.IsFavorite,
                IsArchived = a.IsArchived,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt,
                Client = ResolveClient(a.Client),
                Urls = [.. a.Urls
                    .Where(u => !string.IsNullOrWhiteSpace(u.Url))
                    .Select(u => new ApplicationUrl { Environment = ResolveEnvironment(u.Environment), Url = u.Url.Trim() })],
                Databases = [.. a.Databases.Select(d => new DatabaseConnection
                {
                    Environment = ResolveEnvironment(d.Environment),
                    Engine = d.Engine,
                    Host = d.Host,
                    Port = d.Port,
                    DatabaseName = d.DatabaseName,
                    Username = d.Username,
                    SecretRef = d.SecretRef,
                    // Se restaura el blob cifrado tal cual: sólo es legible con el mismo key ring.
                    PasswordEncrypted = d.PasswordEncrypted,
                })],
            };

            foreach (var tagName in a.Tags.Select(t => t.Trim()).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var tag = tags.FirstOrDefault(t => string.Equals(t.Name, tagName, StringComparison.OrdinalIgnoreCase));
                if (tag is null)
                {
                    tag = new Tag { UserId = uid, Name = tagName };
                    db.Tags.Add(tag);
                    tags.Add(tag);
                }
                app.ApplicationTags.Add(new ApplicationTag { Tag = tag });
            }

            db.Applications.Add(app);
            existingNames.Add(name);
            created++;
        }

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new ImportResultDto(created, skipped, clientsCreated, envsCreated));
    }
}
