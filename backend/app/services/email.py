import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib
from app.config import settings

logger = logging.getLogger(__name__)

# ── Email templates per language ─────────────────────────────────────────────

TEMPLATES = {
    "fr": {
        "subject_existing": "Vous avez été invité sur le calendrier « {calendar_title} »",
        "subject_new": "Invitation à rejoindre Agenda Souterrain",
        "body_existing": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Bonjour {recipient_name},</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> vous a invité sur le calendrier
    <strong>« {calendar_title} »</strong> avec la permission <em>{permission}</em>.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Connectez-vous pour y accéder :
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/login"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Se connecter
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — calendrier collaboratif</p>
</div>""",
        "body_new": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Bonjour,</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> vous a invité à rejoindre le calendrier
    <strong>« {calendar_title} »</strong> sur <strong>Agenda Souterrain</strong>.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Agenda Souterrain est un calendrier collaboratif qui permet de partager
    et gérer des événements en équipe. Créez un compte gratuit pour accéder
    au calendrier et commencer à collaborer.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/register"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Créer un compte
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Une fois inscrit avec l'adresse <strong>{recipient_email}</strong>,
    vous aurez automatiquement accès au calendrier.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — calendrier collaboratif</p>
</div>""",
    },
    "en": {
        "subject_existing": "You have been invited to the calendar \"{calendar_title}\"",
        "subject_new": "Invitation to join Agenda Souterrain",
        "body_existing": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Hello {recipient_name},</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> has invited you to the calendar
    <strong>"{calendar_title}"</strong> with <em>{permission}</em> permission.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Log in to access it:
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/login"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Log in
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaborative calendar</p>
</div>""",
        "body_new": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Hello,</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> has invited you to join the calendar
    <strong>"{calendar_title}"</strong> on <strong>Agenda Souterrain</strong>.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Agenda Souterrain is a collaborative calendar that lets you share and
    manage events as a team. Create a free account to access the calendar
    and start collaborating.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/register"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Create an account
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Once registered with <strong>{recipient_email}</strong>,
    you will automatically have access to the calendar.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaborative calendar</p>
</div>""",
    },
    "nl": {
        "subject_existing": "U bent uitgenodigd voor de kalender \"{calendar_title}\"",
        "subject_new": "Uitnodiging om Agenda Souterrain te gebruiken",
        "body_existing": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Hallo {recipient_name},</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> heeft u uitgenodigd voor de kalender
    <strong>"{calendar_title}"</strong> met <em>{permission}</em> toestemming.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Log in om toegang te krijgen:
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/login"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Inloggen
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaboratieve kalender</p>
</div>""",
        "body_new": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Hallo,</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> heeft u uitgenodigd om deel te nemen aan de kalender
    <strong>"{calendar_title}"</strong> op <strong>Agenda Souterrain</strong>.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Agenda Souterrain is een collaboratieve kalender waarmee u evenementen
    kunt delen en beheren als team. Maak een gratis account aan om toegang
    te krijgen tot de kalender.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/register"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Account aanmaken
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Na registratie met <strong>{recipient_email}</strong>
    krijgt u automatisch toegang tot de kalender.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaboratieve kalender</p>
</div>""",
    },
    "de": {
        "subject_existing": "Sie wurden zum Kalender \"{calendar_title}\" eingeladen",
        "subject_new": "Einladung zu Agenda Souterrain",
        "body_existing": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Hallo {recipient_name},</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> hat Sie zum Kalender
    <strong>"{calendar_title}"</strong> mit der Berechtigung <em>{permission}</em> eingeladen.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Melden Sie sich an, um darauf zuzugreifen:
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/login"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Anmelden
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — kollaborativer Kalender</p>
</div>""",
        "body_new": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Hallo,</h2>
  <p style="color:#57534e;line-height:1.6;">
    <strong>{inviter_name}</strong> hat Sie eingeladen, dem Kalender
    <strong>"{calendar_title}"</strong> auf <strong>Agenda Souterrain</strong> beizutreten.
  </p>
  <p style="color:#57534e;line-height:1.6;">
    Agenda Souterrain ist ein kollaborativer Kalender, mit dem Sie Termine
    im Team teilen und verwalten können. Erstellen Sie ein kostenloses Konto,
    um auf den Kalender zuzugreifen.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{frontend_url}/register"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Konto erstellen
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Nach der Registrierung mit <strong>{recipient_email}</strong>
    erhalten Sie automatisch Zugang zum Kalender.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — kollaborativer Kalender</p>
</div>""",
    },
}

PERMISSION_LABELS = {
    "fr": {
        "no_access": "Aucun accès",
        "read_only_no_details": "Lecture (sans détails)",
        "read_only": "Lecture seule",
        "add_only": "Ajout uniquement",
        "modify_own": "Modifier ses propres",
        "modify": "Modifier",
        "administrator": "Administrateur",
    },
    "en": {
        "no_access": "No access",
        "read_only_no_details": "Read (no details)",
        "read_only": "Read only",
        "add_only": "Add only",
        "modify_own": "Modify own",
        "modify": "Modify",
        "administrator": "Administrator",
    },
    "nl": {
        "no_access": "Geen toegang",
        "read_only_no_details": "Lezen (zonder details)",
        "read_only": "Alleen lezen",
        "add_only": "Alleen toevoegen",
        "modify_own": "Eigen wijzigen",
        "modify": "Wijzigen",
        "administrator": "Beheerder",
    },
    "de": {
        "no_access": "Kein Zugang",
        "read_only_no_details": "Lesen (ohne Details)",
        "read_only": "Nur lesen",
        "add_only": "Nur hinzufügen",
        "modify_own": "Eigene ändern",
        "modify": "Ändern",
        "administrator": "Administrator",
    },
}


def _smtp_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)


def _get_permission_label(permission: str, lang: str) -> str:
    labels = PERMISSION_LABELS.get(lang, PERMISSION_LABELS["en"])
    return labels.get(permission, permission)


async def send_invitation_email(
    recipient_email: str,
    recipient_name: str | None,
    inviter_name: str,
    calendar_title: str,
    permission: str,
    language: str,
    user_exists: bool,
) -> bool:
    """Send an invitation email. Returns True on success, False on failure."""
    if not _smtp_configured():
        logger.warning("SMTP not configured — skipping invitation email to %s", recipient_email)
        return False

    lang = language if language in TEMPLATES else "en"
    tpl = TEMPLATES[lang]
    perm_label = _get_permission_label(permission, lang)

    fmt = dict(
        recipient_name=recipient_name or recipient_email,
        recipient_email=recipient_email,
        inviter_name=inviter_name,
        calendar_title=calendar_title,
        permission=perm_label,
        frontend_url=settings.FRONTEND_URL,
    )

    if user_exists:
        subject = tpl["subject_existing"].format(**fmt)
        html_body = tpl["body_existing"].format(**fmt)
    else:
        subject = tpl["subject_new"].format(**fmt)
        html_body = tpl["body_new"].format(**fmt)

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.SMTP_USER
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Invitation email sent to %s", recipient_email)
        return True
    except Exception:
        logger.exception("Failed to send invitation email to %s", recipient_email)
        return False
