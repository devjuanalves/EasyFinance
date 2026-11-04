# Installed direct dependencies

| Workspace        | Package                     | Exact version |
| ---------------- | --------------------------- | ------------- |
| easyfinance      | @eslint/js                  | 10.0.1        |
| easyfinance      | concurrently                | 10.0.6        |
| easyfinance      | eslint                      | 10.14.0       |
| easyfinance      | eslint-plugin-react-hooks   | 7.1.1         |
| easyfinance      | eslint-plugin-react-refresh | 0.5.7         |
| easyfinance      | globals                     | 17.14.0       |
| easyfinance      | prettier                    | 3.9.10        |
| easyfinance      | prisma                      | 7.10.1        |
| easyfinance      | supertest                   | 7.3.1         |
| easyfinance      | vitest                      | 5.1.0         |
| @easyfinance/web | @easyfinance/shared         | 0.1.0         |
| @easyfinance/web | @tanstack/react-query       | 5.105.3       |
| @easyfinance/web | react                       | 19.3.1        |
| @easyfinance/web | react-dom                   | 19.3.1        |
| @easyfinance/web | react-router-dom            | 7.18.5        |
| @easyfinance/web | @tailwindcss/vite           | 4.3.4         |
| @easyfinance/web | @vitejs/plugin-react        | 6.2.1         |
| @easyfinance/web | tailwindcss                 | 4.3.4         |
| @easyfinance/web | vite                        | 8.3.5         |
| @easyfinance/api | @easyfinance/shared         | 0.1.0         |
| @easyfinance/api | @prisma/client              | 7.10.1        |
| @easyfinance/api | cors                        | 2.8.6         |
| @easyfinance/api | dotenv                      | 18.0.9        |
| @easyfinance/api | express                     | 5.3.0         |

Resolved versions are locked in `package-lock.json`. PostgreSQL server and Playwright are intentionally not provisioned in Block 0. ESLint 10 performs native JSX reference analysis; see [official migration notes](https://eslint.org/docs/latest/use/migrate-to-10.0.0). Prisma CLI/client are installed but client generation and database operations are deferred.
