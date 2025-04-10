<!--
SPDX-FileCopyrightText: tuberry
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# user-theme-x

User theme with user stylesheet and day/night themes auto-switch based on the Night Light.
> Do not go gentle into that Dark side.\
[![license]](/LICENSE.md)

## Installation

### Manual

The latest and supported version should only work on the [current stable version](https://release.gnome.org/calendar/#branches) of GNOME Shell.

```bash
git clone https://github.com/tuberry/user-theme-x.git && cd user-theme-x
meson setup build && meson install -C build
# meson setup build -Dtarget=system && meson install -C build # system-wide, default --prefix=/usr/local
```

For older versions, it's recommended to install via:

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
          --method org.gnome.Shell.Extensions.InstallRemoteExtension 'user-theme-x@tuberry.github.io'
```

It's quite the same as installing from:

### E.G.O

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][EGO]

## Features

![utxpref](https://github.com/user-attachments/assets/2b96bcf1-22de-4bbe-ac68-012baa6c12c1)

## Contributions

Feel free to open an issue or PR in the repo for any question or idea.

### Translations

To initialize or update the po file from sources:

```bash
bash ./cli/update-po.sh [your_lang_code] # like zh_CN, default to $LANG
```

### Developments

To install GJS TypeScript type [definitions](https://www.npmjs.com/package/@girs/gnome-shell):

```bash
npm install @girs/gnome-shell --save-dev
```

[EGO]:https://extensions.gnome.org/extension/3019/user-themes-x/
[license]:https://img.shields.io/badge/license-GPLv3+-green.svg
