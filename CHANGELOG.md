# Changelog

## [1.4.0](https://github.com/joCur/alertosaurus/compare/v1.3.0...v1.4.0) (2026-05-30)


### Features

* open hub with right-click instead of left-click ([#22](https://github.com/joCur/alertosaurus/issues/22)) ([04bc2c0](https://github.com/joCur/alertosaurus/commit/04bc2c0fd60576fbb9e3bdeaafbcd20225590666))
* open hub with right-click instead of left-click on pet ([04bc2c0](https://github.com/joCur/alertosaurus/commit/04bc2c0fd60576fbb9e3bdeaafbcd20225590666))


### Bug Fixes

* show tray icon on Windows ([#25](https://github.com/joCur/alertosaurus/issues/25)) ([fbbed7a](https://github.com/joCur/alertosaurus/commit/fbbed7a8bfa63d9149a1004f3a6585c89baa9645))
* show tray icon on Windows by using createFromBuffer ([fbbed7a](https://github.com/joCur/alertosaurus/commit/fbbed7a8bfa63d9149a1004f3a6585c89baa9645))
* trim icon padding so Windows app icon matches other apps ([#24](https://github.com/joCur/alertosaurus/issues/24)) ([fec156e](https://github.com/joCur/alertosaurus/commit/fec156ede9113a8bf339f99b281843e6ee5b9758))

## [1.3.0](https://github.com/joCur/alertosaurus/compare/v1.2.0...v1.3.0) (2026-05-30)


### Features

* add single notification deletion ([#18](https://github.com/joCur/alertosaurus/issues/18)) ([8b625cf](https://github.com/joCur/alertosaurus/commit/8b625cf1b45231b016acc16e85e90d5d4532cad2))
* add system tray icon with context menu ([#19](https://github.com/joCur/alertosaurus/issues/19)) ([2c3d55b](https://github.com/joCur/alertosaurus/commit/2c3d55b5324e58bbf1781b52bdd1c78e02eb66d0))
* add system tray with app icon and dock hiding ([2c3d55b](https://github.com/joCur/alertosaurus/commit/2c3d55b5324e58bbf1781b52bdd1c78e02eb66d0))
* custom title bar with native window controls ([#20](https://github.com/joCur/alertosaurus/issues/20)) ([0bc2824](https://github.com/joCur/alertosaurus/commit/0bc2824aba0e65914f58776b2e34b50cd313b973))
* use custom title bar with native window controls on hub window ([0bc2824](https://github.com/joCur/alertosaurus/commit/0bc2824aba0e65914f58776b2e34b50cd313b973))

## [1.2.0](https://github.com/joCur/alertosaurus/compare/v1.1.2...v1.2.0) (2026-05-30)


### Features

* add settings tab with gravity toggle ([#17](https://github.com/joCur/alertosaurus/issues/17)) ([18e494f](https://github.com/joCur/alertosaurus/commit/18e494fa9411d31e1f814c7d2c1d072b40d4b6d2))
* add settings tab with gravity toggle to hub window ([18e494f](https://github.com/joCur/alertosaurus/commit/18e494fa9411d31e1f814c7d2c1d072b40d4b6d2))


### Bug Fixes

* Windows roar.exe install + add CLI help command ([#15](https://github.com/joCur/alertosaurus/issues/15)) ([8e17675](https://github.com/joCur/alertosaurus/commit/8e1767535fce642ac3643137e4699f949bda6e5a))

## [1.1.2](https://github.com/joCur/alertosaurus/compare/v1.1.1...v1.1.2) (2026-05-30)


### Bug Fixes

* prevent pet from falling off-screen on multi-monitor setups ([#13](https://github.com/joCur/alertosaurus/issues/13)) ([63d6443](https://github.com/joCur/alertosaurus/commit/63d6443650a802f83afb5693a41d35a2c4a9bea7))
* unpack roar CLI binary from asar so installers can access it ([#12](https://github.com/joCur/alertosaurus/issues/12)) ([d9b0dc9](https://github.com/joCur/alertosaurus/commit/d9b0dc9265fbe4d218a8df74cf763c66afc903e3))

## [1.1.1](https://github.com/joCur/alertosaurus/compare/v1.1.0...v1.1.1) (2026-05-30)


### Bug Fixes

* add Go setup to release workflow ([#10](https://github.com/joCur/alertosaurus/issues/10)) ([eb0f529](https://github.com/joCur/alertosaurus/commit/eb0f529a21ebb578903c95711f1f884e50bd31fd))

## [1.1.0](https://github.com/joCur/alertosaurus/compare/v1.0.2...v1.1.0) (2026-05-30)


### Features

* gravity perch — pet falls and lands on screen surfaces ([#9](https://github.com/joCur/alertosaurus/issues/9)) ([1b00dc8](https://github.com/joCur/alertosaurus/commit/1b00dc8e752c1d65d995c37dece3469fb8c88fc2))
* rewrite roar CLI in Go for standalone binary ([#7](https://github.com/joCur/alertosaurus/issues/7)) ([4f9ea1e](https://github.com/joCur/alertosaurus/commit/4f9ea1e150a7b758a46321af50f2e55a80547982))

## [1.0.2](https://github.com/joCur/alertosaurus/compare/v1.0.1...v1.0.2) (2026-05-30)


### Bug Fixes

* use dynamic version in health check test ([#5](https://github.com/joCur/alertosaurus/issues/5)) ([f1d6360](https://github.com/joCur/alertosaurus/commit/f1d63606ada3e24632a76aa62f5ebba7e9dc16bf))
* use dynamic version in health check test to avoid release breakage ([f1d6360](https://github.com/joCur/alertosaurus/commit/f1d63606ada3e24632a76aa62f5ebba7e9dc16bf))

## [1.0.1](https://github.com/joCur/alertosaurus/compare/v1.0.0...v1.0.1) (2026-05-30)


### Bug Fixes

* add roar CLI to user PATH on Windows install ([#3](https://github.com/joCur/alertosaurus/issues/3)) ([d6faaae](https://github.com/joCur/alertosaurus/commit/d6faaae425658d2e6e50a43412c39eb15a806f8a))

## 1.0.0 (2026-05-30)


### Features

* add config module with runtime file support ([bc74e99](https://github.com/joCur/alertosaurus/commit/bc74e99a7d4aa2d2802878e5ca1ed4366545b3d5))
* add Electron main process with IPC, windows, and server lifecycle ([8897503](https://github.com/joCur/alertosaurus/commit/8897503fa0349ecdabb223c140d7d883d2ada5fc))
* add electron-builder config and complete v1 acceptance ([6a11907](https://github.com/joCur/alertosaurus/commit/6a11907da241d18a075553a25ed745a6edb292c0))
* add HTTP server with /notify and /health endpoints ([027dca5](https://github.com/joCur/alertosaurus/commit/027dca5ff67ce92ce0a72d9e8216b4fa51982833))
* add hub renderer with notification history and day grouping ([e6d0c64](https://github.com/joCur/alertosaurus/commit/e6d0c6414654777c5c79b800c1cfeae3c2ebc9a1))
* add pet state machine with full lifecycle transitions ([af7f401](https://github.com/joCur/alertosaurus/commit/af7f4016c46d3581e27b4e905aa7614f7839332f))
* add release-please for automated versioning and releases ([754a190](https://github.com/joCur/alertosaurus/commit/754a19041893f27e9ae6e29d882647ceced3774c))
* add roar CLI for sending notifications ([fe3a5e7](https://github.com/joCur/alertosaurus/commit/fe3a5e7f06f55f2ea4d1abe326a4ed649e59a0f5))
* add SQLite notification database module ([dc972be](https://github.com/joCur/alertosaurus/commit/dc972be506fc220157cd25f86dc46744af0913cb))
* add toast queue with overflow tracking ([89d9112](https://github.com/joCur/alertosaurus/commit/89d9112322bdbaf379267e332d39af237811755a))
* install roar CLI via platform installers ([c4ef433](https://github.com/joCur/alertosaurus/commit/c4ef433d54e638f0665002d71bf905b291336b39))
* rework sprite system with separate sheets and sequence engine ([b4bc26f](https://github.com/joCur/alertosaurus/commit/b4bc26fc3206fab1016d5e3ec979fbe943d62c50))
* scaffold project with types, build config, and test setup ([f3cf6fc](https://github.com/joCur/alertosaurus/commit/f3cf6fc91339bd9f98d7df5cc0acba6541e59501))
* stacked sprite layers, auto-detect dimensions, dragging animation ([85847a8](https://github.com/joCur/alertosaurus/commit/85847a8d1dc02c51038a7c49df238108e48623ea))
* switch macOS to pkg installer with roar symlink post-install ([c8e2081](https://github.com/joCur/alertosaurus/commit/c8e2081ba7e4129f701dbc7b2a93cc29b93eb309))
* switch to new triceratops sprites with transition animations ([9f661c6](https://github.com/joCur/alertosaurus/commit/9f661c6a7a824727ece1a8980dca1efc15c77768))


### Bug Fixes

* add author email for deb package ([01222e3](https://github.com/joCur/alertosaurus/commit/01222e31c75811e7328a739b5bcefbb4ab4bd6b3))
* add missing sprite sheets (roaring, sitting, sleeping) ([22455fc](https://github.com/joCur/alertosaurus/commit/22455fcde52106072aed08fd6d1152368a58343d))
* address all code review findings ([f91a3f0](https://github.com/joCur/alertosaurus/commit/f91a3f0fe721dbfa2695d24e3c19a71fd14db00b))
* escape NSIS variables, use roar.cmd wrapper for Windows ([80a9e9d](https://github.com/joCur/alertosaurus/commit/80a9e9d5c8f209e1834ca15fbfd41a6c390cc0ec))
* move electron to devDependencies ([7d005a4](https://github.com/joCur/alertosaurus/commit/7d005a46708ccea9dd4a92fc98163ec0a1ca289f))
* remove afterPack, disable asar, symlink CLI directly ([6e2eee0](https://github.com/joCur/alertosaurus/commit/6e2eee0463a17e0832c357ff70a63be75bbb37fa))
* remove duplicate author field in package.json ([8733c21](https://github.com/joCur/alertosaurus/commit/8733c21066ed697025686353602d7b503edbf493))
* remove NSIS EnVar dependency, simplify Windows CLI install ([3defeed](https://github.com/joCur/alertosaurus/commit/3defeedd9a88f270332968a3db803a6b2d80b12c))
* restore electron as devDependency with correct types ([86717c9](https://github.com/joCur/alertosaurus/commit/86717c9a7b82061bc560c4f3dd0e46ae76df27e8))
* run tests before electron-rebuild to avoid native module conflict ([038cd7e](https://github.com/joCur/alertosaurus/commit/038cd7e4d1081f633689e902bc89b416a65ce415))
* use correct pkg scripts directory for macOS post-install ([edbe8d5](https://github.com/joCur/alertosaurus/commit/edbe8d5c9c1185ee54b0b85cce34cf4df624b910))
