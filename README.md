# user-theme-x

Customizable user-theme with user stylesheet and night themes autoswitch support.
> Do not go gentle into that Dark side. <br>
[![license]](/LICENSE)
</br>

## Installation

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][EGO]

Or manually:

```bash
git clone https://github.com/tuberry/user-theme-x.git
cd user-theme-x && make install
```

## Features

![utxprefs](https://user-images.githubusercontent.com/17917040/108627545-1b2dd300-7491-11eb-9d69-11f69769bd0d.png)

### User stylesheet

Load user stylesheet `~/.config/gnome-shell/gnome-shell{,-dark}.css`.

```bash
mkdir -p ~/.config/gnome-shell && touch ~/.config/gnome-shell/gnome-shell.css
```

For example, hide the dropdown arrow:

```css
/* hide the dropdown arrow, not needed since GNOME 40 */
#panel .panel-button .popup-menu-arrow {
    width: 0;
    height: 0;
}
```
or [floating panel]:

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

### Themes autoswitch

These themes will be toggled automatically when Night Light is active or inactive.

## Note

1. The extension is forked from [user-theme].
2. If there is something wrong, try to disable the user stylesheet.

[floating panel]:https://www.reddit.com/r/gnome/comments/mfj1mw/i_noticed_there_isnt_really_help_on_how_to_make/
[EGO]:https://extensions.gnome.org/extension/3019/user-themes-x/
[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[license]:https://img.shields.io/badge/license-LGPLv3-lightgreen.svg
