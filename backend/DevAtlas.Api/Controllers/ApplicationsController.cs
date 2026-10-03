using System.Text;
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
[Route("api/applications")]
public class ApplicationsController(DevAtlasContext db) : ControllerBase
{
    // Tope duro para que un pageSize gigante no se traiga toda la base de una.
    private const int DefaultPageSize = 100;
    private const int MaxPageSize = 500;

    [HttpGet]
    public async Task<ActionResult<List<ApplicationListItemDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? tag,
        [FromQuery] string? sort,
        [FromQuery] int? clientId,
        [FromQuery] string? layer,
        [FromQuery] string? origin,
        [FromQuery] string? status,
        [FromQuery] bool? favorite,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        // Un solo interruptor para todo lo que se saca de la vista principal:
        // archivadas, deprecadas y las de clientes ocultos.
        [FromQuery] bool includeHidden = false)
    {
        if (page < 1) page = 1;
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var uid = this.GetUserId();
        var query = db.Applications
            .Where(a => a.UserId == uid)
            .Include(a => a.Client)
            .Include(a => a.Urls).ThenInclude(u => u.Environment)
            .Include(a => a.ApplicationTags).ThenInclude(at => at.Tag)
            .AsQueryable();

        // Pedir un estado explícito manda sobre la exclusión por defecto: si alguien filtra
        // por "deprecated", quiere ver las deprecadas aunque no haya marcado "ver ocultas".
        var statusFilter = NormalizeStatusFilter(status);

        if (!includeHidden)
        {
            query = query
                .Where(a => !a.IsArchived)
                .Where(a => a.Client == null || !a.Client.IsHidden);

            if (statusFilter is null)
            {
                query = query.Where(a => a.Status != DeprecatedStatus);
            }
        }

        if (statusFilter is not null)
        {
            query = query.Where(a => a.Status == statusFilter);
        }

        if (favorite == true)
        {
            query = query.Where(a => a.IsFavorite);
        }

        if (clientId.HasValue)
        {
            query = query.Where(a => a.ClientId == clientId.Value);
        }

        // La búsqueda barre todo lo que uno recuerda de una app: cómo se llama, qué hace,
        // con qué está hecha, quién la mantiene, de qué cliente es, y sus tags y notas.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(a =>
                a.Name.ToLower().Contains(term) ||
                (a.Description != null && a.Description.ToLower().Contains(term)) ||
                (a.Stack != null && a.Stack.ToLower().Contains(term)) ||
                (a.Owner != null && a.Owner.ToLower().Contains(term)) ||
                (a.Notes != null && a.Notes.ToLower().Contains(term)) ||
                (a.Client != null && a.Client.Name.ToLower().Contains(term)) ||
                a.ApplicationTags.Any(at => at.Tag!.Name.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(tag))
        {
            query = query.Where(a => a.ApplicationTags.Any(at => at.Tag!.Name == tag));
        }

        if (NormalizeLayer(layer) is string layerFilter)
        {
            query = query.Where(a => a.Layer == layerFilter);
        }

        // origin=external deja sólo servicios de terceros; origin=own, sólo las propias.
        if (string.Equals(origin, "external", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.IsExternal);
        }
        else if (string.Equals(origin, "own", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => !a.IsExternal);
        }

        // Favoritos siempre primero; dentro de cada grupo, el criterio elegido.
        var ordered = sort switch
        {
            "updated" => query.OrderByDescending(a => a.IsFavorite).ThenByDescending(a => a.UpdatedAt),
            "created" => query.OrderByDescending(a => a.IsFavorite).ThenByDescending(a => a.CreatedAt),
            _ => query.OrderByDescending(a => a.IsFavorite).ThenBy(a => a.Name),
        };

        // El total va en un header para no romper la forma de la respuesta (sigue siendo un
        // array). El listado se pagina siempre: con pocas apps entra todo en la primera página.
        var total = await ordered.CountAsync();
        Response.Headers["X-Total-Count"] = total.ToString();
        Response.Headers["X-Page"] = page.ToString();
        Response.Headers["X-Page-Size"] = pageSize.ToString();

        var result = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new ApplicationListItemDto(
                a.PublicId,
                a.Name,
                a.Description,
                a.Stack,
                a.RepoPath,
                a.Owner,
                a.Layer,
                a.IsExternal,
                a.Status,
                a.ClientId,
                a.Client != null ? a.Client.Name : null,
                a.Client != null ? a.Client.Color : null,
                a.IsFavorite,
                a.IsArchived,
                a.Urls.OrderBy(u => u.Environment!.SortOrder)
                    .Select(u => new ApplicationUrlDto(u.Id, u.Environment!.Name, u.Environment.Color, u.Url)).ToList(),
                a.ApplicationTags.Select(at => at.Tag!.Name).ToList()))
            .ToListAsync();

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApplicationDetailDto>> GetById(Guid id)
    {
        var uid = this.GetUserId();
        var app = await db.Applications
            .Include(a => a.Client)
            .Include(a => a.Urls).ThenInclude(u => u.Environment)
            .Include(a => a.Databases).ThenInclude(d => d.Environment)
            .Include(a => a.ApplicationTags).ThenInclude(at => at.Tag)
            .FirstOrDefaultAsync(a => a.PublicId == id && a.UserId == uid);

        if (app is null) return NotFound();

        return Ok(ToDetailDto(app));
    }

    [HttpPost]
    public async Task<ActionResult<ApplicationDetailDto>> Create(UpsertApplicationDto dto)
    {
        if (ValidarEstadoYCapa(dto) is ActionResult invalido) return invalido;

        var app = new Application
        {
            UserId = this.GetUserId(),
            Name = dto.Name,
            Description = dto.Description,
            RepoPath = dto.RepoPath,
            Stack = dto.Stack,
            Notes = dto.Notes,
            Owner = dto.Owner,
            Layer = NormalizeLayer(dto.Layer),
            IsExternal = dto.IsExternal,
            Status = NormalizeStatus(dto.Status),
            IsFavorite = dto.IsFavorite,
            IsArchived = dto.IsArchived,
            Client = await ResolveClientAsync(dto.Client),
        };

        app.Urls = await BuildUrlsAsync(dto.Urls);
        await SyncTagsAsync(app, dto.Tags);

        db.Applications.Add(app);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = app.PublicId }, ToDetailDto(app));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApplicationDetailDto>> Update(Guid id, UpsertApplicationDto dto)
    {
        if (ValidarEstadoYCapa(dto) is ActionResult invalido) return invalido;

        var uid = this.GetUserId();
        var app = await db.Applications
            .Include(a => a.Urls)
            .Include(a => a.ApplicationTags)
            .FirstOrDefaultAsync(a => a.PublicId == id && a.UserId == uid);

        if (app is null) return NotFound();

        app.Name = dto.Name;
        app.Description = dto.Description;
        app.RepoPath = dto.RepoPath;
        app.Stack = dto.Stack;
        app.Notes = dto.Notes;
        app.Owner = dto.Owner;
        app.Layer = NormalizeLayer(dto.Layer);
        app.IsExternal = dto.IsExternal;
        app.Status = NormalizeStatus(dto.Status);
        app.IsFavorite = dto.IsFavorite;
        app.IsArchived = dto.IsArchived;
        app.UpdatedAt = DateTime.UtcNow;

        var client = await ResolveClientAsync(dto.Client);
        app.Client = client;
        if (client is null) app.ClientId = null;

        db.ApplicationUrls.RemoveRange(app.Urls);
        app.Urls = await BuildUrlsAsync(dto.Urls);

        db.ApplicationTags.RemoveRange(app.ApplicationTags);
        app.ApplicationTags.Clear();
        await SyncTagsAsync(app, dto.Tags);

        await db.SaveChangesAsync();

        // app ya tiene Urls y ApplicationTags (con Tag) reasignados en memoria por SyncTagsAsync.
        return Ok(ToDetailDto(app));
    }

    [HttpPatch("{id:guid}/favorite")]
    public async Task<IActionResult> SetFavorite(Guid id, [FromBody] bool value)
    {
        var uid = this.GetUserId();
        var app = await db.Applications.FirstOrDefaultAsync(a => a.PublicId == id && a.UserId == uid);
        if (app is null) return NotFound();

        app.IsFavorite = value;
        app.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id:guid}/archive")]
    public async Task<IActionResult> SetArchived(Guid id, [FromBody] bool value)
    {
        var uid = this.GetUserId();
        var app = await db.Applications.FirstOrDefaultAsync(a => a.PublicId == id && a.UserId == uid);
        if (app is null) return NotFound();

        app.IsArchived = value;
        app.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Copia una app con sus URLs, tags y cliente. No copia las conexiones a bases: sus
    /// passwords son secretos de ese entorno y duplicarlos multiplica el lugar donde viven.
    /// </summary>
    [HttpPost("{id:guid}/duplicate")]
    public async Task<ActionResult<ApplicationDetailDto>> Duplicate(Guid id)
    {
        var uid = this.GetUserId();
        var origen = await db.Applications
            .Include(a => a.Client)
            .Include(a => a.Urls).ThenInclude(u => u.Environment)
            .Include(a => a.ApplicationTags).ThenInclude(at => at.Tag)
            .FirstOrDefaultAsync(a => a.PublicId == id && a.UserId == uid);

        if (origen is null) return NotFound();

        var copia = new Application
        {
            UserId = uid,
            Name = $"{origen.Name} (copia)",
            Description = origen.Description,
            RepoPath = origen.RepoPath,
            Stack = origen.Stack,
            Notes = origen.Notes,
            Owner = origen.Owner,
            Layer = origen.Layer,
            IsExternal = origen.IsExternal,
            Status = origen.Status,
            ClientId = origen.ClientId,
            // La copia nace como borrador: ni favorita ni archivada, para que no se
            // cuele en la vista destacada antes de que uno la termine de ajustar.
            IsFavorite = false,
            IsArchived = false,
            Urls = origen.Urls.Select(u => new ApplicationUrl { EnvironmentId = u.EnvironmentId, Url = u.Url }).ToList(),
            ApplicationTags = origen.ApplicationTags.Select(at => new ApplicationTag { TagId = at.TagId }).ToList(),
        };

        db.Applications.Add(copia);
        await db.SaveChangesAsync();

        var creada = await db.Applications
            .Include(a => a.Client)
            .Include(a => a.Urls).ThenInclude(u => u.Environment)
            .Include(a => a.Databases).ThenInclude(d => d.Environment)
            .Include(a => a.ApplicationTags).ThenInclude(at => at.Tag)
            .FirstAsync(a => a.Id == copia.Id);

        return CreatedAtAction(nameof(GetById), new { id = creada.PublicId }, ToDetailDto(creada));
    }

    /// <summary>
    /// Aplica una acción a varias apps de una. Evita N llamadas desde el listado cuando
    /// hay que archivar media docena de una vez.
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<BulkResultDto>> Bulk(BulkActionDto dto)
    {
        var accion = dto.Action?.Trim().ToLowerInvariant();
        if (accion is not ("archive" or "unarchive" or "favorite" or "unfavorite" or "delete"))
        {
            return BadRequest(new { error = $"Acción desconocida: '{dto.Action}'." });
        }

        var uid = this.GetUserId();
        var apps = await db.Applications
            .Where(a => a.UserId == uid && dto.Ids.Contains(a.PublicId))
            .ToListAsync();

        if (accion == "delete")
        {
            db.Applications.RemoveRange(apps);
        }
        else
        {
            foreach (var app in apps)
            {
                switch (accion)
                {
                    case "archive": app.IsArchived = true; break;
                    case "unarchive": app.IsArchived = false; break;
                    case "favorite": app.IsFavorite = true; break;
                    case "unfavorite": app.IsFavorite = false; break;
                }
                app.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        // Los ids que no aparecen son de otro usuario o no existen: se informan como
        // no encontrados en vez de fallar toda la operación.
        return Ok(new BulkResultDto(apps.Count, dto.Ids.Distinct().Count() - apps.Count));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var uid = this.GetUserId();
        var app = await db.Applications.FirstOrDefaultAsync(a => a.PublicId == id && a.UserId == uid);
        if (app is null) return NotFound();

        db.Applications.Remove(app);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("stats")]
    public async Task<ActionResult<StatsDto>> GetStats()
    {
        // Datos de resumen: se pueden reusar unos segundos sin que nadie note la diferencia.
        // "private" porque son de un usuario y no deben cachearse en ningún proxy compartido.
        Response.Headers.CacheControl = "private, max-age=30";

        var uid = this.GetUserId();

        // Todo se agrega en la base: traer el catálogo entero a memoria para contarlo
        // escalaba con la cantidad de apps y con sus tags, sin necesidad.
        var mias = db.Applications.Where(a => a.UserId == uid);
        var activas = mias.Where(a => !a.IsArchived);

        var total = await activas.CountAsync();
        var favoritas = await activas.CountAsync(a => a.IsFavorite);
        var archivadas = await mias.CountAsync(a => a.IsArchived);

        // El GroupBy se proyecta a un anónimo: EF no sabe traducir el constructor de un
        // record posicional adentro de la agregación. El armado del DTO va después.
        var byStack = (await activas
                .Where(a => a.Stack != null && a.Stack != "")
                .GroupBy(a => a.Stack!)
                .Select(g => new { Name = g.Key, Count = g.Count() })
                .ToListAsync())
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Name)
            .Select(x => new NameCount(x.Name, x.Count))
            .ToList();

        var topTags = (await db.ApplicationTags
                .Where(at => at.Application!.UserId == uid && !at.Application.IsArchived)
                .GroupBy(at => at.Tag!.Name)
                .Select(g => new { Name = g.Key, Count = g.Count() })
                .ToListAsync())
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Name)
            .Select(x => new NameCount(x.Name, x.Count))
            .ToList();

        return Ok(new StatsDto(
            Total: total,
            Favorites: favoritas,
            Archived: archivadas,
            DistinctStacks: byStack.Count,
            DistinctTags: topTags.Count,
            ByStack: byStack.Take(6).ToList(),
            TopTags: topTags.Take(8).ToList()));
    }

    /// <summary>
    /// El catálogo en CSV, para abrirlo en Excel o pegarlo en una planilla compartida.
    /// Respeta los mismos filtros de visibilidad que el listado.
    /// </summary>
    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv([FromQuery] bool includeHidden = false)
    {
        var uid = this.GetUserId();
        var query = db.Applications
            .Where(a => a.UserId == uid)
            .Include(a => a.Client)
            .Include(a => a.Urls).ThenInclude(u => u.Environment)
            .Include(a => a.ApplicationTags).ThenInclude(at => at.Tag)
            .AsQueryable();

        if (!includeHidden)
        {
            query = query
                .Where(a => !a.IsArchived)
                .Where(a => a.Status != DeprecatedStatus)
                .Where(a => a.Client == null || !a.Client.IsHidden);
        }

        var apps = await query.OrderBy(a => a.Name).ToListAsync();

        var csv = new StringBuilder();
        csv.AppendLine("Nombre,Cliente,Estado,Capa,Stack,Responsable,Repo,Externa,Favorita,Archivada,Tags,URLs");

        foreach (var a in apps)
        {
            var tags = string.Join(" | ", a.ApplicationTags.Select(at => at.Tag!.Name));
            var urls = string.Join(" | ", a.Urls
                .OrderBy(u => u.Environment!.SortOrder)
                .Select(u => $"{u.Environment!.Name}: {u.Url}"));

            csv.AppendLine(string.Join(',', new[]
            {
                Csv(a.Name), Csv(a.Client?.Name), Csv(a.Status), Csv(a.Layer), Csv(a.Stack),
                Csv(a.Owner), Csv(a.RepoPath), Csv(a.IsExternal ? "sí" : "no"),
                Csv(a.IsFavorite ? "sí" : "no"), Csv(a.IsArchived ? "sí" : "no"), Csv(tags), Csv(urls),
            }));
        }

        // BOM para que Excel en Windows abra los acentos bien sin preguntar nada.
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        return File(bytes, "text/csv", $"devatlas-{DateTime.Now:yyyy-MM-dd}.csv");
    }

    // Comillas dobles alrededor y duplicadas adentro: es lo que espera cualquier lector de CSV.
    private static string Csv(string? value) =>
        string.IsNullOrEmpty(value) ? "\"\"" : $"\"{value.Replace("\"", "\"\"")}\"";

    [HttpGet("tags")]
    public async Task<ActionResult<List<string>>> GetTags()
    {
        Response.Headers.CacheControl = "private, max-age=30";

        var uid = this.GetUserId();
        var tags = await db.Tags.Where(t => t.UserId == uid).OrderBy(t => t.Name).Select(t => t.Name).ToListAsync();
        return Ok(tags);
    }

    public const string DeprecatedStatus = "deprecated";

    private static readonly HashSet<string> ValidStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "active", "paused", DeprecatedStatus };

    private static string NormalizeStatus(string? status)
    {
        var s = status?.Trim().ToLowerInvariant();
        return !string.IsNullOrEmpty(s) && ValidStatuses.Contains(s) ? s : "active";
    }

    /// <summary>
    /// Al guardar, un estado o una capa que no existen son un error del que llama, no algo
    /// para corregir en silencio: se avisa en vez de guardar otra cosa que la pedida.
    /// (En los filtros del listado sí se ignoran, porque ahí un valor viejo no debe vaciar
    /// la pantalla.)
    /// </summary>
    private ActionResult? ValidarEstadoYCapa(UpsertApplicationDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.Status) && !ValidStatuses.Contains(dto.Status.Trim()))
        {
            ModelState.AddModelError(nameof(dto.Status),
                $"Estado inválido: '{dto.Status}'. Valores posibles: {string.Join(", ", ValidStatuses)}.");
        }

        if (!string.IsNullOrWhiteSpace(dto.Layer) && !ValidLayers.Contains(dto.Layer.Trim()))
        {
            ModelState.AddModelError(nameof(dto.Layer),
                $"Capa inválida: '{dto.Layer}'. Valores posibles: {string.Join(", ", ValidLayers)}.");
        }

        return ModelState.IsValid ? null : ValidationProblem(ModelState);
    }

    // Filtro de estado: un valor que no sea de la lista se ignora en vez de vaciar el listado.
    private static string? NormalizeStatusFilter(string? status)
    {
        var s = status?.Trim().ToLowerInvariant();
        return !string.IsNullOrEmpty(s) && ValidStatuses.Contains(s) ? s : null;
    }

    private static readonly HashSet<string> ValidLayers = new(StringComparer.OrdinalIgnoreCase)
        { "frontend", "backend", "fullstack", "mobile" };

    // Capa desconocida o vacía queda en null: es un campo opcional, no se inventa un default.
    private static string? NormalizeLayer(string? layer)
    {
        var s = layer?.Trim().ToLowerInvariant();
        return !string.IsNullOrEmpty(s) && ValidLayers.Contains(s) ? s : null;
    }

    // Resuelve el cliente por nombre, creándolo si no existe (get-or-create).
    private async Task<Client?> ResolveClientAsync(string? name)
    {
        var n = name?.Trim();
        if (string.IsNullOrEmpty(n)) return null;

        var uid = this.GetUserId();
        var clients = await db.Clients.Where(c => c.UserId == uid).ToListAsync();
        var client = clients.FirstOrDefault(c => string.Equals(c.Name, n, StringComparison.OrdinalIgnoreCase));
        if (client is null)
        {
            // Color automático: si todos nacieran con el mismo, los chips del listado
            // no distinguirían un cliente de otro.
            client = new Client
            {
                Name = n,
                UserId = uid,
                Color = ClientPalette.NextFree(clients.Select(c => c.Color)),
            };
            db.Clients.Add(client);
        }
        return client;
    }

    // Resuelve cada URL a su ambiente del catálogo, creándolo si no existe (get-or-create por nombre).
    private async Task<List<ApplicationUrl>> BuildUrlsAsync(List<ApplicationUrlInput> inputs)
    {
        var uid = this.GetUserId();
        var envs = await db.Environments.Where(e => e.UserId == uid).ToListAsync();
        var nextOrder = envs.Count == 0 ? 1 : envs.Max(e => e.SortOrder) + 1;

        var urls = new List<ApplicationUrl>();
        foreach (var input in inputs)
        {
            var envName = input.Environment.Trim();
            if (envName.Length == 0 || string.IsNullOrWhiteSpace(input.Url)) continue;

            var env = envs.FirstOrDefault(e => string.Equals(e.Name, envName, StringComparison.OrdinalIgnoreCase));
            if (env is null)
            {
                env = new AppEnvironment { Name = envName, SortOrder = nextOrder++, Color = "#6b7280", UserId = uid };
                db.Environments.Add(env);
                envs.Add(env);
            }

            urls.Add(new ApplicationUrl { Environment = env, Url = input.Url.Trim() });
        }

        return urls;
    }

    private async Task SyncTagsAsync(Application app, List<string> tagNames)
    {
        var normalized = tagNames
            .Select(t => t.Trim())
            .Where(t => t.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalized.Count == 0) return;

        var uid = this.GetUserId();
        var existingTags = await db.Tags
            .Where(t => t.UserId == uid && normalized.Contains(t.Name))
            .ToListAsync();

        var existingNames = existingTags.Select(t => t.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var newTags = normalized
            .Where(n => !existingNames.Contains(n))
            .Select(n => new Tag { Name = n, UserId = uid })
            .ToList();

        if (newTags.Count > 0)
        {
            db.Tags.AddRange(newTags);
        }

        var allTags = existingTags.Concat(newTags);
        app.ApplicationTags = allTags.Select(t => new ApplicationTag { Tag = t }).ToList();
    }

    private static ApplicationDetailDto ToDetailDto(Application app) => new(
        app.PublicId,
        app.Name,
        app.Description,
        app.RepoPath,
        app.Stack,
        app.Notes,
        app.Owner,
        app.Layer,
        app.IsExternal,
        app.Status,
        app.ClientId,
        app.Client?.Name,
        app.Client?.Color,
        app.IsFavorite,
        app.IsArchived,
        app.CreatedAt,
        app.UpdatedAt,
        app.Urls.OrderBy(u => u.Environment!.SortOrder)
            .Select(u => new ApplicationUrlDto(u.Id, u.Environment!.Name, u.Environment.Color, u.Url)).ToList(),
        app.Databases.OrderBy(d => d.Environment!.SortOrder)
            .Select(d => new DatabaseConnectionDto(
                d.Id, d.Environment!.Name, d.Environment.Color, d.Engine,
                d.Host, d.Port, d.DatabaseName, d.Username,
                !string.IsNullOrEmpty(d.PasswordEncrypted), d.SecretRef)).ToList(),
        app.ApplicationTags.Select(at => at.Tag!.Name).ToList());
}
