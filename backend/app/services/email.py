import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# ── Invitation templates per language ────────────────────────────────────────

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

# ── Verification email templates ─────────────────────────────────────────────

VERIFICATION_TEMPLATES = {
    "fr": {
        "subject": "Confirmez votre adresse email — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Bienvenue {name} !</h2>
  <p style="color:#57534e;line-height:1.6;">
    Merci d'avoir créé votre compte sur <strong>Agenda Souterrain</strong>.
    Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{verification_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Confirmer mon email
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — calendrier collaboratif</p>
</div>""",
    },
    "en": {
        "subject": "Confirm your email address — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Welcome {name}!</h2>
  <p style="color:#57534e;line-height:1.6;">
    Thank you for creating your account on <strong>Agenda Souterrain</strong>.
    Click the button below to confirm your email address.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{verification_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Confirm my email
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    This link expires in 24 hours. If you didn't create an account, ignore this email.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaborative calendar</p>
</div>""",
    },
    "nl": {
        "subject": "Bevestig uw emailadres — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Welkom {name}!</h2>
  <p style="color:#57534e;line-height:1.6;">
    Bedankt voor het aanmaken van uw account op <strong>Agenda Souterrain</strong>.
    Klik op de onderstaande knop om uw emailadres te bevestigen.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{verification_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Email bevestigen
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Deze link verloopt over 24 uur. Als u geen account heeft aangemaakt, negeer deze email.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaboratieve kalender</p>
</div>""",
    },
    "de": {
        "subject": "Bestätigen Sie Ihre E-Mail-Adresse — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Willkommen {name}!</h2>
  <p style="color:#57534e;line-height:1.6;">
    Vielen Dank für die Erstellung Ihres Kontos auf <strong>Agenda Souterrain</strong>.
    Klicken Sie auf die Schaltfläche unten, um Ihre E-Mail-Adresse zu bestätigen.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{verification_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      E-Mail bestätigen
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Dieser Link läuft in 24 Stunden ab. Falls Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — kollaborativer Kalender</p>
</div>""",
    },
}

# ── Password reset templates ─────────────────────────────────────────────────

PASSWORD_RESET_TEMPLATES = {
    "fr": {
        "subject": "Réinitialisation de votre mot de passe — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Réinitialisation du mot de passe</h2>
  <p style="color:#57534e;line-height:1.6;">
    Vous avez demandé la réinitialisation de votre mot de passe.
    Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{reset_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Nouveau mot de passe
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — calendrier collaboratif</p>
</div>""",
    },
    "en": {
        "subject": "Reset your password — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Password Reset</h2>
  <p style="color:#57534e;line-height:1.6;">
    You have requested a password reset.
    Click the button below to choose a new password.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{reset_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      New password
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    This link expires in 1 hour. If you didn't make this request, ignore this email.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaborative calendar</p>
</div>""",
    },
    "nl": {
        "subject": "Wachtwoord opnieuw instellen — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Wachtwoord opnieuw instellen</h2>
  <p style="color:#57534e;line-height:1.6;">
    U heeft gevraagd om uw wachtwoord opnieuw in te stellen.
    Klik op de onderstaande knop om een nieuw wachtwoord te kiezen.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{reset_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Nieuw wachtwoord
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Deze link verloopt over 1 uur. Als u dit verzoek niet heeft gedaan, negeer deze email.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — collaboratieve kalender</p>
</div>""",
    },
    "de": {
        "subject": "Passwort zurücksetzen — Agenda Souterrain",
        "body": """
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#292524;">Passwort zurücksetzen</h2>
  <p style="color:#57534e;line-height:1.6;">
    Sie haben eine Passwortzurücksetzung angefordert.
    Klicken Sie auf die Schaltfläche unten, um ein neues Passwort zu wählen.
  </p>
  <p style="text-align:center;margin:24px 0;">
    <a href="{reset_url}"
       style="background:#f59e0b;color:white;padding:12px 28px;border-radius:12px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Neues Passwort
    </a>
  </p>
  <p style="color:#a8a29e;font-size:13px;">
    Dieser Link läuft in 1 Stunde ab. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.
  </p>
  <p style="color:#a8a29e;font-size:13px;">Agenda Souterrain — kollaborativer Kalender</p>
</div>""",
    },
}


# ── Core helpers ─────────────────────────────────────────────────────────────

def _email_configured() -> bool:
    return bool(settings.RESEND_API_KEY)


def log_email_status():
    """Log email configuration status at startup."""
    if _email_configured():
        logger.info(
            "Resend configured: from=%s, api_key=%s***",
            settings.EMAIL_FROM, settings.RESEND_API_KEY[:8],
        )
    else:
        logger.warning(
            "Resend NOT configured — no emails will be sent. "
            "Set RESEND_API_KEY in environment variables.",
        )


def _get_permission_label(permission: str, lang: str) -> str:
    labels = PERMISSION_LABELS.get(lang, PERMISSION_LABELS["en"])
    return labels.get(permission, permission)


async def _send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via Resend HTTP API. Returns True on success."""
    if not _email_configured():
        logger.warning("Resend not configured — skipping email to %s", to)
        return False

    logger.info("Sending email to %s (subject: %s)", to, subject[:60])
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.EMAIL_FROM,
                    "to": [to],
                    "subject": subject,
                    "html": html_body,
                },
            )
        if resp.status_code in (200, 201):
            logger.info("Email sent successfully to %s (id: %s)", to, resp.json().get("id"))
            return True
        else:
            logger.error(
                "Resend API error %s for %s: %s",
                resp.status_code, to, resp.text,
            )
            return False
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


# ── Public send functions ────────────────────────────────────────────────────

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

    return await _send_email(recipient_email, subject, html_body)


async def send_verification_email(
    email: str,
    name: str,
    token: str,
    language: str = "fr",
) -> bool:
    """Send email verification link. Returns True on success."""
    lang = language if language in VERIFICATION_TEMPLATES else "en"
    tpl = VERIFICATION_TEMPLATES[lang]
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = tpl["subject"]
    html_body = tpl["body"].format(name=name, verification_url=verification_url)
    return await _send_email(email, subject, html_body)


async def send_password_reset_email(
    email: str,
    token: str,
    language: str = "fr",
) -> bool:
    """Send password reset link. Returns True on success."""
    lang = language if language in PASSWORD_RESET_TEMPLATES else "en"
    tpl = PASSWORD_RESET_TEMPLATES[lang]
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = tpl["subject"]
    html_body = tpl["body"].format(reset_url=reset_url)
    return await _send_email(email, subject, html_body)
