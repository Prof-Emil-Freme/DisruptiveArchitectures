function toggle_menu(){
    var menu = document.getElementById("course_menu");
    if(!menu.checkVisibility()){menu.style.display = "inherit";}
    else{menu.style.display = "none";}
}

document.addEventListener("DOMContentLoaded", function(){
    var cookies = document.cookie.split(";");
    var theme = "main.css";
    cookies.every(function(cookie){
        if(cookie.includes("theme=")){
            theme = cookie.split("=")[1];
            set_theme(theme);
            return false;
        }
        return true;
    });
});


function toggle_themes(){
    var styletag = document.getElementById("maincss");
    let themes = [ "main.css", "light.css", "hc_dark.css", "hc_light.css" ];
    var path = styletag.href;
    var active = path.split("/").pop();
    var next = themes.indexOf(active) + 1;
    next = next >= 4 ? 0 : next;
    var newtheme = themes[next]
    set_theme(newtheme);
}

function set_theme(theme_name){
    console.log(`set_theme: ${theme_name}`)
    var styletag = document.getElementById("maincss");
    var path = styletag.href;
    var active = path.split("/").pop();
    document.cookie = `theme=${theme_name}`;
    path = path.replace(active, theme_name);
    console.log(path);
    styletag.href = path;
}
