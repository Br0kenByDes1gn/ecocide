# ECOCIDE on Kubernetes — the development loop.
#
#   tilt up        # build the image into minikube, `helm upgrade --install`, stream logs
#   tilt down      # `helm uninstall` the release (PVCs and the Secret are kept)
#
# The image is the production Dockerfile, unchanged: one container serving the
# API and the built SPA. A source change rebuilds it (Docker caches the pnpm
# install layer) and rolls the single pod.
#
# No `live_update`: Tilt 0.37 dropped `restart_container()`, and this container
# runs the BullMQ worker in-process — a synced `dist/` is inert until the process
# restarts, which is what the rebuild does anyway.
#
# Tilt drives a real Helm release, not `kubectl apply` of a rendered chart, so
# the loop exercises the same install path as production (`helm list` shows it,
# and a CI release on the same cluster upgrades cleanly).
#
# Gemini defaults to the deterministic offline simulation (no tokens, no cost).
# For real audits:
#
#   ECOCIDE_GEMINI_MODE=api GEMINI_API_KEY=... tilt up
#
# Installs into the current kubectl namespace (minikube: `default`).

load('ext://helm_resource', 'helm_resource')

allow_k8s_contexts(['minikube', 'kind-kind', 'k3d-ecocide'])

image_name = 'ecocide-dev'
gemini_mode = os.getenv('ECOCIDE_GEMINI_MODE', 'off')
gemini_key = os.getenv('GEMINI_API_KEY', '')

docker_build(image_name, '.', dockerfile='Dockerfile')

# Manual (press the button) — the chart's migrations run in the pod's init
# container, so tests are not part of the deploy path.
local_resource(
    'test',
    cmd='pnpm test',
    deps=['apps', 'packages'],
    ignore=['**/node_modules/**', '**/dist/**', '**/*.tsbuildinfo'],
    trigger_mode=TRIGGER_MODE_MANUAL,
    auto_init=False,
)

helm_resource(
    'ecocide',
    './charts/ecocide',
    release_name='ecocide',
    image_deps=[image_name],
    image_keys=[('image.repository', 'image.tag')],
    # `image_tags`/`image_keys` set the image; this is everything else the dev
    # cluster needs. Better Auth's trustedOrigins compare against publicUrl
    # exactly, so it must match the port-forward below.
    flags=[
        '--set', 'image.pullPolicy=IfNotPresent',
        '--set', 'app.publicUrl=http://localhost:8080',
        '--set', 'ingress.enabled=false',
        '--set', 'app.gemini.mode=' + gemini_mode,
    ] + (
        ['--set', 'secrets.data.GEMINI_API_KEY=' + gemini_key] if gemini_key else []
    ) + (
        # A real values file (credentials included) can drive the dev loop too:
        #   ECOCIDE_VALUES=~/.config/ecocide/values.yaml tilt up
        ['--values', os.path.expanduser(os.getenv('ECOCIDE_VALUES'))]
        if os.getenv('ECOCIDE_VALUES') else []
    ),
)

# `helm_resource` applies the chart itself, so Tilt does not own the pods and
# cannot port-forward them; forward the Service instead.
local_resource(
    'app-url',
    cmd='true',
    serve_cmd='kubectl port-forward svc/ecocide 8080:3000',
    resource_deps=['ecocide'],
)
