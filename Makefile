HTMX_VERSION := 4.0.0
MARKDOWN_IT_VERSION := 15.0.2
ALPINE_VERSION := 3.17.4
INTER_VERSION := 4.1

.PHONY: dev vendor

dev:
	python3 -m http.server 8080

# Versions are pinned above; update them and rerun this target to upgrade.
vendor:
	@HTMX_VERSION="$(HTMX_VERSION)" \
		MARKDOWN_IT_VERSION="$(MARKDOWN_IT_VERSION)" \
		ALPINE_VERSION="$(ALPINE_VERSION)" \
		INTER_VERSION="$(INTER_VERSION)" \
		./scripts/vendor.sh
