# user-theme-x

Customizable user-theme with user stylesheet and night themes auto-switch based on the Night Light.
> Do not go gentle into that Dark side.\
[![license]](/LICENSE.md)

## Installation

### Manual

The latest and supported version should only work on the most current stable version of GNOME Shell.

```bash
git clone https://github.com/tuberry/user-theme-x.git && cd user-theme-x
meson setup build && meson install -C build
# meson setup build -Dtarget=system && meson install -C build # system-wide, default --prefix=/usr/local
```

For older versions, it's recommended to install via:

### E.G.O

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][EGO]

## Features

![utxpref](https://github.com/user-attachments/assets/2b96bcf1-22de-4bbe-ac68-012baa6c12c1)

### Stylesheet

Load user stylesheet from `~/.config/gnome-shell/gnome-shell{-light,-dark}.css`.

```bash
mkdir -p ~/.config/gnome-shell && touch ~/.config/gnome-shell/gnome-shell-light.css
```

For example, [floating panel](https://www.reddit.com/r/gnome/comments/mfj1mw/i_noticed_there_isnt_really_help_on_how_to_make/):


```css
/* floating panel */
#panelBox {
  padding: 0.35em 0.9em;
  background: transparent;
}

#panel {
  border-radius: 0.9em;
}
```

## Notes

* The extension is forked from [user-theme].
* If there is something wrong, try to disable the user stylesheet.

## Contributions

Any contribution is welcome.

### Ideas

For any question or idea, feel free to open an issue or PR in the repo.

### Translations

To update the po file from sources:

```bash
bash ./cli/update-po.sh [your_lang_code] # like zh_CN, default to $LANG
```

### Developments

To install GJS TypeScript type [definitions](https://www.npmjs.com/package/@girs/gnome-shell):

```bash
npm install @girs/gnome-shell --save-dev
```

[EGO]:https://extensions.gnome.org/extension/3019/user-themes-x/
[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[license]:https://img.shields.io/badge/license-GPLv3+-green.svg
