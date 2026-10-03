namespace DevAtlas.Api.Models;

public class Tag
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;

    public List<ApplicationTag> ApplicationTags { get; set; } = [];
}

public class ApplicationTag
{
    public int ApplicationId { get; set; }
    public Application? Application { get; set; }
    public int TagId { get; set; }
    public Tag? Tag { get; set; }
}
