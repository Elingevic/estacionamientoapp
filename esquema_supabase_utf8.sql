Need to install the following packages:
supabase@2.107.0
Ok to proceed? (y) 
DESCRIPTION
  Dumps data or schemas from the remote database.

USAGE
  supabase db dump [flags]

FLAGS
  --dry-run                Prints the pg_dump script that would be executed.
  --data-only              Dumps only data records.
  --use-copy               Use copy statements in place of inserts.
  --exclude, -x string     List of schema.tables to exclude from data-only dump.
  --role-only              Dumps only cluster roles.
  --keep-comments          Keeps commented lines from pg_dump output.
  --file, -f string        File path to save the dumped contents.
  --db-url string          Dumps from the database specified by the connection string (must be percent-encoded).
  --linked                 Dumps from the linked project.
  --local                  Dumps from the local database.
  --password, -p string    Password to your remote Postgres database.
  --schema, -s string      Comma separated list of schema to include.

GLOBAL FLAGS
  --help, -h                Show help information
  --version, -v             Show version information
  --completions choice      Print shell completion script (choices: bash, zsh, fish, sh)
  --log-level choice        Sets the minimum log level (choices: all, trace, debug, info, warn, warning, error, fatal, none)
  --output-format choice    Output format: text (default), json, or stream-json (NDJSON) (choices: text, json, stream-json)
  --output, -o choice       Output format of status variables. (choices: env, pretty, json, toml, yaml)
  --profile string          Use a specific profile for connecting to Supabase API.
  --debug                   Output debug logs to stderr.
  --workdir string          Path to a Supabase project directory.
  --experimental            Enable experimental features.
  --network-id string       Use the specified Docker network instead of a generated one.
  --yes                     Answer yes to all prompts.
  --dns-resolver choice     Look up domain names using the specified resolver. (choices: native, https)
  --create-ticket           Create a support ticket for any CLI error.
  --agent choice            Override agent detection: yes, no, or auto (default auto). (choices: auto, yes, no)
