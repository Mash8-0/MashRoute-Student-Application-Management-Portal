# Migration notes

- Historical students intentionally retain `sourceType = NULL` and `sourceAgentId = NULL`.
- No legacy free-text agent field exists, so no ownership guesses or automatic Agent records are created.
- New students are required by the service layer to submit an explicit source.
- Review and back up production data before applying this migration. This migration has not been run against production.
