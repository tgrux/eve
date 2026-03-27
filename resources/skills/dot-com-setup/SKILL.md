---
name: dotcom-setup
description: Set up the dot-com Rails application for local development. Use when a developer needs to run the app locally, whether first-time setup or returning after time away. Handles Ruby, Node, Postgres, Colima/Docker, database seeding, and all dependencies.
license: Proprietary
compatibility: Requires macOS, Homebrew, and GitHub access to kin organization
metadata:
  author: kin
  version: "2.0"
---

## Overview

This skill sets up the dot-com Rails application for local development. It handles two scenarios:

1. **First-time setup** - Developer has never run the app before
2. **Returning developer** - Developer needs to get back up to speed after time away

## Useful bin/ Scripts

| Script | Purpose |
|--------|---------|
| `bin/setup` | Idempotent setup: bundle install, db:prepare, clear logs |
| `bin/start-dev-workers` | Auto-reloading Sidekiq workers (restarts on file changes) |
| `bin/rails s` | Start Rails server (preferred over `bin/start-dev-server`) |
| `bin/compose` | Docker-compose wrapper with GitHub Container Registry auth |

## Diagnostic: Determine Setup State

Before proceeding, check the developer's current state:

```bash
which rbenv && rbenv version
which node && node -v
which yarn
which colima && colima status
which docker
brew services list | grep postgres
```

Ask the user: "Is this your first time setting up dot-com, or are you returning after some time away?"

---

## Path A: First-Time Setup

### Step 1: Install System Dependencies

Use the Brewfile to install all required dependencies:

```bash
brew bundle --file=.claude/skills/dotcom/references/Brewfile
```

Or install manually:
```bash
brew update
brew install openssl libyaml libffi rbenv ruby-build
brew install postgresql@18 postgis
brew install redis
brew install imagemagick vips
brew install 1password-cli
brew install --cask chromedriver
```

After installing rbenv, add to `~/.zshrc`:
```bash
eval "$(rbenv init -)"
```

Then restart the shell: `exec zsh`

### Step 2: Install Ruby

```bash
cat .ruby-version  # Check required version
CFLAGS="-Wno-error=implicit-function-declaration" rbenv install $(cat .ruby-version)
rbenv global $(cat .ruby-version)
exec zsh  # Restart shell
ruby -v   # Verify
```

### Step 3: Install Node.js

Install nvm first: https://github.com/nvm-sh/nvm#installing-and-updating

Then:
```bash
nvm install 22
nvm alias default 22
npm install --global yarn
```

### Step 4: Configure Private Package Access

The user needs a GitHub Personal Access Token with `read:packages` scope.

Save the token:
```bash
echo "YOUR_TOKEN_HERE" > ~/.github_access_token
```

Configure npm:
```bash
echo '@kin:registry=https://npm.pkg.github.com' >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=$(cat ~/.github_access_token)" >> ~/.npmrc
```

Configure bundler:
```bash
read -p "Enter your GitHub username: " GITHUB_USERNAME
bundle config set --global rubygems.pkg.github.com "${GITHUB_USERNAME}:$(cat ~/.github_access_token)"
```

### Step 5: Configure Sidekiq Enterprise

Ask the user: "Do you want to use 1Password CLI to fetch Sidekiq credentials automatically, or retrieve them manually?"

**Option A: Using 1Password CLI** (requires 1Password desktop app integration enabled):
```bash
op read "op://Shared/Sidekiq Enterprise/notesPlain"
```
This will display the credentials. Extract the `bundle config` command from the output.

**Option B: Manual lookup**:
1. Open 1Password
2. Search for "Sidekiq Enterprise" in the Shared vault
3. Copy the `bundle config` command from the note

Run the command (format: `bundle config enterprise.contribsys.com USERNAME:PASSWORD`)

### Step 6: Configure pg gem

```bash
bundle config build.pg --with-pg-config=/opt/homebrew/opt/postgresql@18/bin/pg_config
```

### Step 7: Start Postgres

**Important**: Stop any other Postgres versions first to avoid conflicts.

```bash
brew services stop postgresql@14 2>/dev/null
brew services stop postgresql@16 2>/dev/null
brew services start postgresql@18
/opt/homebrew/opt/postgresql@18/bin/createuser -s postgres
```

### Step 8: Install Dependencies

```bash
gem install bundler
bundle install
yarn install
```

### Step 9: Start Background Services

#### 9a: Set up Colima (Docker runtime)

We use [Colima](https://github.com/abiosoft/colima) instead of Docker Desktop. Colima provides a local Docker daemon without the Docker Desktop license cost.

```bash
colima start
docker context use colima
```

To give Colima more resources (recommended):
```bash
colima stop
colima start --cpu 8 --memory 24 --disk 200
```

Configure Docker CLI plugins by adding to `~/.docker/config.json`:
```json
{
  "cliPluginsExtraDirs": [
    "/opt/homebrew/lib/docker/cli-plugins"
  ]
}
```

If the file already exists, merge the `cliPluginsExtraDirs` key into the existing JSON.

#### 9b: Start Docker services

```bash
docker compose up -d
```

If you hit Docker Hub rate limits, you can use local Homebrew services instead:
```bash
brew services start redis
echo 'ELASTICSEARCH_ENABLED="false"' >> .env.local
```

### Step 10: Create Local Environment File

```bash
cat >> .env.local << 'EOF'
ANGULAR_HOST="localhost:4200"
QA_SMOKE_TEST_ENV=localhost:3000
PAYMENT_PROCESSING_SYSTEM_NAMESPACE=YourFirstnameLastname
EOF
```

Replace `YourFirstnameLastname` with the developer's actual name, using PascalCase with no spaces (e.g., `JohnSmith`).

### Step 11: Set Up Database

```bash
rake db:drop db:create db:schema:load
```

**Note**: Full seeding (`rake db:setup`) requires AWS credentials. For basic local dev, schema load is sufficient.

To seed auto policies interactively:
```bash
rake auto:interactive
```

For test database:
```bash
./wooten_shuffle
```

If fork safety error occurs:
```bash
spring stop
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
./wooten_shuffle
```

### Step 12: Allow Chromedriver (for tests)

```bash
xattr -d com.apple.quarantine $(which chromedriver)
```

### Step 13: Install Git Hooks

```bash
lefthook install
```

### Step 14: Start the Application

Terminal 1 - Background services (requires Colima running):
```bash
docker compose up  # or skip if using homebrew redis
```

Terminal 2 - Sidekiq workers:
```bash
./bin/start-dev-workers
```

Terminal 3 - Rails server:
```bash
./bin/rails s
```

Visit http://localhost:3000/ - you should see the Kin quote flow.

---

## Path B: Returning Developer

### Step 1: Check Version Requirements

```bash
echo "Required Ruby: $(cat .ruby-version)"
echo "Current Ruby: $(ruby -v 2>/dev/null || echo 'not installed')"
echo "Required Node: $(cat .nvmrc)"
echo "Current Node: $(node -v 2>/dev/null || echo 'not installed')"
```

### Step 2: Update Ruby (if needed)

```bash
CFLAGS="-Wno-error=implicit-function-declaration" rbenv install $(cat .ruby-version)
rbenv global $(cat .ruby-version)
exec zsh
```

### Step 3: Update Node (if needed)

```bash
nvm install $(cat .nvmrc)
nvm use $(cat .nvmrc)
```

### Step 4: Ensure Correct Postgres Version

```bash
brew services stop postgresql@14 2>/dev/null
brew services stop postgresql@16 2>/dev/null
brew services start postgresql@18
```

### Step 5: Update Dependencies and Database

**Option A: Quick path** (if no major changes):
```bash
bin/setup
```

**Option B: Manual** (if bin/setup fails):
```bash
bundle install
yarn install
rake db:migrate
./wooten_shuffle
```

### Step 6: Start Services

```bash
colima start  # if not already running
brew services start redis  # or docker compose up -d
./bin/start-dev-workers &
./bin/rails s
```

---

## Updating After Pulling Changes

After rebasing or pulling in new changes, run these commands to sync your local environment:

```bash
bundle install          # Install any new/updated gems
yarn install            # Install any new/updated npm packages
rake db:migrate         # Run any new migrations
./wooten_shuffle        # Update test database schema
```

**Quick one-liner:**
```bash
bundle install && yarn install && rake db:migrate && ./wooten_shuffle
```

If migrations fail due to schema conflicts:
```bash
rake db:drop db:create db:schema:load
./wooten_shuffle
```

---

## Running Tests

### Quick Dev Runs (single spec / small batch)

Docker services must be running via Colima (OpenSearch + Redis):

```bash
colima status || colima start
bin/compose up
```

Run a single file or directory with Spring for speed:

```bash
bin/rspec spec/path/to_spec.rb
bin/rspec spec/models/
```

### Running the Full CI Suite Locally

Use this to reproduce what the `ruby-tests` GitHub Actions job does.

#### 1. Set required environment variables

Add to `.env.test`:

```
CI=1
TZ=UTC
RAILS_MASTER_KEY=<value from 1Password: "dot-com rails test key">
```

Why these matter:
- `CI=1` — VCR uses `record: :none`, matching CI. Without it, tests may hit external services or behave differently.
- `TZ=UTC` — CI runs in UTC; date-sensitive tests fail locally without this due to timezone drift.
- `RAILS_MASTER_KEY` — required to boot the app with encrypted credentials. In 1Password under "dot-com rails test key".

> ⚠️ `CI=1` and `./bin/rspec` (Spring) are incompatible. `CI=1` sets `config.cache_classes = true`, but Spring requires `config.enable_reloading = true`. Use `./bin/rspec` only for quick single-spec dev runs where you temporarily remove `CI=1`.

#### 2. Start Docker services (via Colima)

In a separate terminal (leave running):

```bash
colima status || colima start
docker compose up
```

#### 3. Reset the test database

Run before every full suite run:

```bash
bundle exec rake db:drop db:create db:schema:load
./wooten_shuffle
```

#### 4. Run the full Ruby test suite

Most reliable (sequential):

```bash
bundle exec rspec spec/ subsystems/*/spec/ --tag '~pact'
```

Faster (parallel, less stable):

```bash
bundle exec turbo_tests spec/ subsystems/*/spec/
```

Use `-n 4` or `-n 6` with `turbo_tests` — higher worker counts overload Colima/Docker and cause Redis timeouts and browser session failures.

#### 5. Rerun failures individually

Some failures are infrastructure-related, not real regressions. Always rerun before treating as real:

```bash
bundle exec rspec <path/to/failing_spec.rb>
```

If it passes on rerun, it was flaky/infrastructure — not a product bug.

### Known CI/Test Issues

**`subsystems/lenderdock/spec/jobs/lenderdock/mortgagee_corrections_batch_job_spec.rb`**
Consistently fails with `bundle exec rspec` due to Rails 7.2 `Object#with` collision with `rspec-sidekiq`. Passes with `./bin/rspec` (Spring changes load order) and passes in CI. Not a real failure — needs rewrite to avoid `.with([args])` matcher chain.

**JS/browser specs (`invalid session id` errors)**
Specs tagged `:js` use Selenium + Chrome via Capybara. Under high `turbo_tests` parallelism, browser sessions collapse causing `invalid session id` errors across unrelated specs. This is infrastructure overload, not a test bug. Rerun individually or reduce worker count.

### bin/test-all — DO NOT USE

Avoid `bin/test-all`. It gates on external dependencies (`dog` CLI, AWS SSO) that are unnecessary for running specs locally, and adds friction without value over running `bundle exec rspec` or `bundle exec turbo_tests` directly. Use the commands in section 4 above instead.

### Frontend (Karma + Mocha)

```bash
yarn test            # single run
yarn test:watch      # watch mode
```

### Chromedriver (macOS Gatekeeper)

If you get "chromedriver Not Opened — Apple could not verify":

```bash
brew upgrade chromedriver
xattr -d com.apple.quarantine $(which chromedriver)
```

Only needed for Capybara feature specs. Skip them with `--tag ~type:feature` if you don't need them.

### Test Metadata Tags

| Tag | Effect |
|---|---|
| `:focus` | Run only this example |
| `:timecop` | Freeze time |
| `:elasticsearch` | Creates/destroys OpenSearch index for test |
| `:doc_gen` | Allow real PDF generation (normally stubbed) |
| `:activate_feature` / `:deactivate_feature` | Toggle feature flags |
| `:webmock` | Disable VCR, use raw HTTP mocking |
| `:pact` | Disable both VCR and WebMock |
| `:non_transactional_test` | DB state persists across test |
| `:force_keycloak_auth` | Forces real Keycloak auth (not mocked) |
| `:with_env` | Modify env vars via ClimateControl |

### CI (GitHub Actions)

CI uses a different path — `knapsack_pro:queue:rspec` across 10 parallel nodes with containerized Postgres 16 + PostGIS, Redis 7, OpenSearch 2.11. Pact tests excluded (`--tag ~pact`).

Frontend CI: `yarn test`, `yarn pretty-check`, `yarn type-check`.

Subsystem boundaries: `bundle exec packwerk check`.

---

## Verification Checklist

- [ ] `ruby -v` matches `.ruby-version`
- [ ] `node -v` matches `.nvmrc`
- [ ] Postgres 18 is running: `brew services list | grep postgresql@18`
- [ ] Colima is running: `colima status`
- [ ] Redis is running (docker via Colima, or homebrew)
- [ ] http://localhost:3000/ loads the application

---

## Troubleshooting

### "401 Unauthorized" from yarn
GitHub token missing or expired. Regenerate PAT and update `~/.npmrc`.

### "401 Unauthorized" from bundle install (Sidekiq)
Sidekiq Enterprise credentials not configured. Run Step 5 from first-time setup.

### pg gem fails to build
```bash
bundle config build.pg --with-pg-config=/opt/homebrew/opt/postgresql@18/bin/pg_config
bundle install
```

### PostGIS extension not available
Ensure you're running Postgres 18 (not 14 or 16). PostGIS is built for Postgres 17/18.
```bash
brew services stop postgresql@14
brew services stop postgresql@16
brew services start postgresql@18
brew reinstall postgis
```

### Docker Hub rate limit ("toomanyrequests")
Use local Homebrew services instead:
```bash
brew services start redis
echo 'ELASTICSEARCH_ENABLED="false"' >> .env.local
```

### Colima not running / Docker daemon not found
```bash
colima start
docker context use colima
```

If you previously had Docker Desktop, make sure it's stopped/uninstalled and that the docker context points to Colima.

### vips/image_processing error
```bash
brew install vips
```

### Redis connection refused
```bash
brew services start redis
# or (requires Colima running)
docker compose up -d
```

### AWS SSO Token error during seeding
Full seeding requires AWS credentials. For basic local dev, use:
```bash
rake db:drop db:create db:schema:load
```

### Spring/fork safety crash
```bash
spring stop
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
```

### rbenv shim error
```bash
rm -f ~/.rbenv/shims/.rbenv-shim
rbenv rehash
```
