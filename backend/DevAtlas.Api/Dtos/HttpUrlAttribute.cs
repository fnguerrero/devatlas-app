using System.ComponentModel.DataAnnotations;

namespace DevAtlas.Api.Dtos;

/// <summary>
/// Exige una URL absoluta http/https. El <c>[Url]</c> de DataAnnotations es más laxo
/// (acepta ftp y formas raras) y acá lo que se guarda son accesos que el front va a abrir
/// en una pestaña: si no arranca con http, el navegador la interpreta como ruta relativa.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class HttpUrlAttribute : ValidationAttribute
{
    public override bool IsValid(object? value)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s)) return true; // el [Required] se encarga

        return Uri.TryCreate(s.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    public override string FormatErrorMessage(string name) =>
        $"{name} tiene que ser una URL que empiece con http:// o https://.";
}
