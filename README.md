# user-theme-x

Customizable user-theme with user stylesheet and night themes auto-switch based on the Night Light.
> Do not go gentle into that Dark side. <br>
[![license]](/LICENSE)
</br>

## Installation

### Manual

The latest and supported version should only work on the most current stable version of GNOME Shell.

```bash
git clone https://github.com/tuberry/user-theme-x.git && cd user-theme-x
meson setup build && meson install -C build
# meson setup build -Dtarget=system && meson install -C build # system-wide, default --prefix=/usr/local
```

For contributing translations:

```bash
meson setup build && cat po/LINGUAS
# echo your_lang_code >> po/LINGUAS #if your_lang_code is not in po/LINGUAS
meson compile gnome-shell-extension-user-theme-x-update-po -C build
nvim po/your_lang_code.po # edit with an editor
# meson setup build --wipe && meson compile gnome-shell-extension-color-picker-gmo -C build # build mo
```

For older versions, it's recommended to install via:

### E.G.O

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][EGO]

## Features

![utxpref](https://user-images.githubusercontent.com/17917040/159209648-46c3acae-852b-44a7-87e9-50e59925d18a.png)


### Stylesheet

Load user stylesheet from `~/.config/gnome-shell/gnome-shell{,-dark}.css`.

```bash
mkdir -p ~/.config/gnome-shell && touch ~/.config/gnome-shell/gnome-shell.css
```

For example,  [floating panel]:

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

## Note

* The extension is forked from [user-theme].
* If there is something wrong, try to disable the user stylesheet.

[floating panel]:https://www.reddit.com/r/gnome/comments/mfj1mw/i_noticed_there_isnt_really_help_on_how_to_make/
[EGO]:https://extensions.gnome.org/extension/3019/user-themes-x/
[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[license]:https://img.shields.io/badge/license-LGPLv3-lightgreen.svg
