{{/*
Expand the name of the chart.
*/}}
{{- define "ecocide.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "ecocide.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart name and version as used by the chart label.
*/}}
{{- define "ecocide.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "ecocide.labels" -}}
helm.sh/chart: {{ include "ecocide.chart" . }}
{{ include "ecocide.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — the Deployment's immutable selector. Never add anything to
this define that can change between releases, or `helm upgrade` is rejected.
*/}}
{{- define "ecocide.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ecocide.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Name of the service account.
*/}}
{{- define "ecocide.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "ecocide.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Name of the Secret holding the runtime credentials: either the one the chart
renders, or the caller's `existingSecret`.
*/}}
{{- define "ecocide.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "ecocide.fullname" . }}
{{- end }}
{{- end }}

{{/*
Name of the ConfigMap holding the non-secret environment.
*/}}
{{- define "ecocide.configMapName" -}}
{{- printf "%s-config" (include "ecocide.fullname" .) }}
{{- end }}

{{/*
Fully-qualified image reference.
*/}}
{{- define "ecocide.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}

{{/*
Host of the PostgreSQL the app talks to.
*/}}
{{- define "ecocide.postgresHost" -}}
{{- if eq .Values.postgres.mode "bundled" }}
{{- printf "%s-postgres" (include "ecocide.fullname" .) }}
{{- else }}
{{- required "postgres.external.host is required when postgres.mode=external" .Values.postgres.external.host }}
{{- end }}
{{- end }}

{{/*
Host of the Redis the queue talks to.
*/}}
{{- define "ecocide.redisHost" -}}
{{- printf "%s-redis" (include "ecocide.fullname" .) }}
{{- end }}

{{/*
The DATABASE_URL the app (and the migration init container) resolves.

The bundled password is passed in by the caller because it is only computed once
(in secret.yaml) — two `randAlphaNum` calls would produce two passwords and lock
the app out of its own database.

User and password are percent-encoded: they land in the userinfo section of the
URL, where an unescaped `@`, `/` or `:` would silently point the client at a
different host. A hex password is unchanged by this.
*/}}
{{- define "ecocide.databaseUrl" -}}
{{- $values := .Values }}
{{- $password := .password }}
{{- if $values.secrets.data.DATABASE_URL }}
{{- $values.secrets.data.DATABASE_URL }}
{{- else if eq $values.postgres.mode "external" }}
{{- printf "postgres://%s:%s@%s:%d/%s" (urlquery $values.postgres.external.username) (urlquery $password) (include "ecocide.postgresHost" .) (int $values.postgres.external.port) $values.postgres.external.database }}
{{- else }}
{{- printf "postgres://%s:%s@%s:%d/%s" (urlquery $values.postgres.username) (urlquery $password) (include "ecocide.postgresHost" .) (int $values.postgres.port) $values.postgres.database }}
{{- end }}
{{- end }}

{{/*
The REDIS_URL the job queue resolves: explicit URL, else the bundled service,
else empty (the dispatcher falls back to inline execution).
*/}}
{{- define "ecocide.redisUrl" -}}
{{- if .Values.redis.external.url }}
{{- .Values.redis.external.url }}
{{- else if eq .Values.redis.mode "bundled" }}
{{- printf "redis://%s:6379" (include "ecocide.redisHost" .) }}
{{- end }}
{{- end }}

{{/*
Checksums, so a config/secret change rolls the pods (the app reads env only at
boot; a stale pod would keep serving the old config forever).
*/}}
{{- define "ecocide.configChecksum" -}}
{{- include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
{{- end }}
