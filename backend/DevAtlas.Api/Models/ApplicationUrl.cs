namespace DevAtlas.Api.Models;

public class ApplicationUrl
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application? Application { get; set; }

    public int EnvironmentId { get; set; }
    public AppEnvironment? Environment { get; set; }

    public string Url { get; set; } = string.Empty;
}
