# user-theme-x
Customizable user-theme with user stylesheet and night theme/icon autoswitch support.


![user-theme-x](https://user-images.githubusercontent.com/17917040/80617630-ed484f80-8a74-11ea-9664-8c498f026c07.gif)


## Installation
```bash
git clone https://github.com/tuberry/user-theme-x.git
cp -rf ./user-theme-x/'user-theme-x@tuberry.github.io' ~/.local/share/gnome-shell/extensions/
```
then restart gnome shell and enable it in Extensions or gnome-tweaks.

## Features
### User stylesheet
Load user stylesheet form `~/.config/gnome-shell/gnome-shell.css`, which should be created by your own. Here are two examples in the GIF:
#### panel font size
I prefer bigger font in applications but that's a little larger for panel.
```css
stage {
	font-size: 13pt;
	font-style: italic; /* for test */
}
```
#### hide menu arrow
Set the size to 0 to 'hide' the arrow in panel menu.
```css
#panel .panel-button .popup-menu-arrow {
	width: 0;
	height: 0;
}
```
### Night theme auto switch
Fill the blanks according to your themes in consistent one-to-one match. The gtk/shell/icons theme will be toggled automatically when Night Light is on and off.

![Screenshot](https://user-images.githubusercontent.com/17917040/80617887-38626280-8a75-11ea-8bcb-85566cd426e9.png)


## Note
1. The extension is based on and compatible with [user-theme]. In other word, this extension has full support for user-theme except changing shell theme with gnome-tweaks because user-theme's [uuid] is hardcoded in gnome-tweaks. If you really need to change shell theme that way, please install both of them.
2. If there is something wrong with your shell theme after updating, don't forget to disable the user-stylesheet to exclude the influence of your code snippets, also it's a good habbit to add comments for them'.

[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[uuid]:https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/merge_requests/110
