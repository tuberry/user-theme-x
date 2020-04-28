# user-theme-x
Load custom stylesheet to override user theme.

![user-theme-x](https://user-images.githubusercontent.com/17917040/80433301-1bb91400-8929-11ea-9d02-81813cf3e963.gif)

## Usage:
1. copy `user-theme@gnome-shell-extensions.gcampax.github.com` to `~/.local/share/gnome-shell/extensions/`;
2. put your stylesheet to `~/.config/gnome-shell/gnome-shell.css`;
3. restart Gnome Shell and enable it.

## Note
1. The extension is conflicted with [user-theme] but has full support for user-theme, ~~whose [uuid] hardcoded in gnome-tweaks, but it seems to be an independent extension now~~. You can use it as user-theme by turning `Load user stylesheet` off or make some tweaks with that on.
2. If you have something wrong with your shell theme after updating, don't forget to disable the user-stylesheet to exclude the influence of the code snippets of your own.

[user-theme]:https://extensions.gnome.org/extension/19/user-themes/
[uuid]:https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/merge_requests/110
