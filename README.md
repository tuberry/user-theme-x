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
cp -rf ./user-theme-x/'user-theme-x@tuberry.github.io' ~/.local/share/gnome-shell/extensions/
```

## Features
![user-theme-x](https://user-images.githubusercontent.com/17917040/80664068-5311f700-8ac8-11ea-9c8c-b228edb8a0ea.gif)
### User stylesheet
Load user stylesheet form `~/.config/gnome-shell/gnome-shell.css`, which should be created by yourself.
```bash
mkdir -p ~/.config/gnome-shell && touch ~/.config/gnome-shell/gnome-shell.css
```
Here are 3 examples:
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
#### for Light Dict users
Users of [Light Dict] may want to change the font of panel:
```css
.light-dict-content {
    font-size: 13pt;
}
```
### Night theme auto switch
Fill the blanks according to your themes in consistent one-to-one match. The themes will be toggled automatically when Night Light is active and inactive. Also user stylesheet (`~/.config/gnome-shell/gnome-shell-dark.css`) is supported.

![Screenshot](https://user-images.githubusercontent.com/17917040/80617887-38626280-8a75-11ea-8bcb-85566cd426e9.png)

## Note
1. The extension is forked from and compatible with [user-theme]. In other word, this extension has full support for user-theme except changing shell theme with gnome-tweaks because of [uuid]. If you really need to change shell theme that way, please install both of them.
2. If there is something wrong with gnome shell theme after updating, don't forget to disable the user-stylesheet to exclude the influence of your code snippets, also it's a good habbit to add comments for them.

[EGO]:https://extensions.gnome.org/extension/3019/user-themes-x/
[Light Dict]:https://github.com/tuberry/light-dict
[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[uuid]:https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/merge_requests/110
[license]:https://img.shields.io/badge/license-LGPLv3-lightgreen.svg
