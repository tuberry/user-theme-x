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
![image](https://user-images.githubusercontent.com/17917040/99734013-10177f80-2afd-11eb-9d63-2a1ba8831793.png)
### User stylesheet
Load user stylesheet form `~/.config/gnome-shell/gnome-shell.css`, which should be created by yourself.
```bash
mkdir -p ~/.config/gnome-shell && touch ~/.config/gnome-shell/gnome-shell.css
```
Here are 2 examples:
#### panel font size
Change the font size of top panel.
```css
stage {
    font-size: 13pt;
    font-style: italic; /* for test */
}
```
#### hide menu arrow
Set the size to 0 to *hide* the arrow in panel menu.
```css
#panel .panel-button .popup-menu-arrow {
    width: 0;
    height: 0;
}
```

### Night theme auto switch
The themes will be toggled automatically when Night Light is active and inactive.

## Note
1. The extension is forked from and compatible with [user-theme].
2. If there is something wrong, try to disable the user-stylesheet to exclude the influence of your code snippets.

[EGO]:https://extensions.gnome.org/extension/3019/user-themes-x/
[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[uuid]:https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/merge_requests/110
[license]:https://img.shields.io/badge/license-LGPLv3-lightgreen.svg
