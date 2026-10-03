namespace DevAtlas.Api.Models;

// Cliente / proyecto que agrupa aplicaciones (ej. Acme -> portal-web, api-pedidos...).
public class Client
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#6b7280";

    // Cliente archivado: sus aplicaciones no salen en el listado principal.
    public bool IsHidden { get; set; }

    public List<Application> Applications { get; set; } = [];
}
