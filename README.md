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
make && make install
# make LANG=your_language_code mergepo # for translators
```

For older versions, it's necessary to switch the git tag before `make`:

```bash
# git tag # to see available versions
git checkout your_gnome_shell_version
```

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
