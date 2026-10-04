HTMX_VERSION := 2.0.8
MARKDOWN_IT_VERSION := 14.1.0
VENDOR_DIR := vendor

.PHONY: dev vendor

dev:
	python3 -m http.server 8080

# Versions are pinned above; update them and rerun this target to upgrade.
vendor:
	@mkdir -p "$(VENDOR_DIR)"
	curl --fail --silent --show-error --location \
		"https://cdn.jsdelivr.net/npm/htmx.org@$(HTMX_VERSION)/dist/htmx.min.js" \
		--output "$(VENDOR_DIR)/htmx.min.js.tmp"
	mv "$(VENDOR_DIR)/htmx.min.js.tmp" "$(VENDOR_DIR)/htmx.min.js"
	curl --fail --silent --show-error --location \
		"https://cdn.jsdelivr.net/npm/markdown-it@$(MARKDOWN_IT_VERSION)/dist/markdown-it.min.js" \
		--output "$(VENDOR_DIR)/markdown-it.min.js.tmp"
	mv "$(VENDOR_DIR)/markdown-it.min.js.tmp" "$(VENDOR_DIR)/markdown-it.min.js"
