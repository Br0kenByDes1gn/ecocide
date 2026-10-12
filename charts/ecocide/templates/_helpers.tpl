{{/*
Expand the name of the chart.
*/}}
{{- define "ecocide.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
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
Create chart name and version as used by the chart label.
*/}}
{{- define "ecocide.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
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
Selector labels
*/}}
{{- define "ecocide.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ecocide.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "ecocide.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "ecocide.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Resolve the Redis connection string for the job queue:
  1. explicit .Values.redis.url (external/managed Redis), else
  2. the bundled Redis service when .Values.redis.enabled, else
  3. empty → the app falls back to inline (no-Redis) job execution.
*/}}
{{- define "ecocide.redisUrl" -}}
{{- if .Values.redis.url -}}
{{- .Values.redis.url -}}
{{- else if .Values.redis.enabled -}}
{{- printf "redis://%s-redis:6379" (include "ecocide.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Resolve the name of the secret containing GEMINI_API_KEY
*/}}
{{- define "ecocide.secretName" -}}
{{- if .Values.existingSecret }}
{{- .Values.existingSecret }}
{{- else }}
{{- printf "%s-secret" (include "ecocide.fullname" .) }}
{{- end }}
{{- end }}
