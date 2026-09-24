"""Shared permanent account-deletion cascade."""

import logging
from dataclasses import dataclass

from app.db.artifacts import delete_run_artifacts
from app.graph import executor
from app.models import (
    Device,
    LoginSession,
    PasswordResetToken,
    PendingSignup,
    Project,
    Run,
    SignInAlert,
    User,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AccountDeletionResult:
    projects_deleted: int
    runs_deleted: int
    artifacts_deleted: int


async def delete_user_account(user: User) -> AccountDeletionResult:
    """Delete a user and every owned project, run, artifact, and pending auth record.

    Children are removed before the user so a partial failure leaves an owner that can
    still be used to find and clean up anything remaining.
    """
    user_id = str(user.id)
    runs = await Run.find(Run.user_id == user_id).to_list()
    run_ids = [str(run.id) for run in runs]

    for run_id in run_ids:
        executor.cancel(run_id)

    artifacts_deleted = await delete_run_artifacts(run_ids)
    runs_deleted = (await Run.find(Run.user_id == user_id).delete()).deleted_count
    projects_deleted = (await Project.find(Project.user_id == user_id).delete()).deleted_count
    await PasswordResetToken.find(PasswordResetToken.user_id == user_id).delete()
    await SignInAlert.find(SignInAlert.user_id == user_id).delete()
    await LoginSession.find(LoginSession.user_id == user_id).delete()
    await Device.find(Device.user_id == user_id).delete()
    await PendingSignup.find(PendingSignup.email == user.email).delete()
    await user.delete()

    logger.info(
        "Account %s deleted: %d runs, %d projects, %d artifacts",
        user_id,
        runs_deleted,
        projects_deleted,
        artifacts_deleted,
    )
    return AccountDeletionResult(
        projects_deleted=projects_deleted,
        runs_deleted=runs_deleted,
        artifacts_deleted=artifacts_deleted,
    )
