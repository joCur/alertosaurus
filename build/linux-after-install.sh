#!/bin/bash
# electron-builder uses productName for install dir
ln -sf /opt/Alertosaurus/resources/app/dist/cli/index.js /usr/local/bin/roar 2>/dev/null || \
ln -sf /opt/alertosaurus/resources/app/dist/cli/index.js /usr/local/bin/roar 2>/dev/null
chmod +x /usr/local/bin/roar 2>/dev/null || true
