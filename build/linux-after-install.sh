#!/bin/bash
# electron-builder uses productName for install dir
ln -sf /opt/Alertosaurus/resources/app/dist/cli/roar /usr/local/bin/roar 2>/dev/null || \
ln -sf /opt/alertosaurus/resources/app/dist/cli/roar /usr/local/bin/roar 2>/dev/null
