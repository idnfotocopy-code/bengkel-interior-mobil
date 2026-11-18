from PIL import Image, ImageDraw, ImageFont
F="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BG=(42,32,25,255); AMB=(245,158,11,255); CREAM=(232,226,218,255)
def draw_mark(d, cx, cy, s):
    # car silhouette + "BI"
    f=ImageFont.truetype(F,int(s*0.42))
    d.text((cx,cy-s*0.10),"BI",font=f,fill=AMB,anchor="mm")
    w=s*0.62; y=cy+s*0.22; h=s*0.11
    d.rounded_rectangle([cx-w/2,y-h/2,cx+w/2,y+h/2],radius=h/2,fill=CREAM)
    d.rounded_rectangle([cx-w*0.30,y-h*1.25,cx+w*0.22,y-h*0.3],radius=h*0.5,fill=CREAM)
    r=h*0.55
    for x in (cx-w*0.28,cx+w*0.28): d.ellipse([x-r,y+h*0.25-r,x+r,y+h*0.25+r],fill=AMB,outline=BG,width=max(1,int(s*0.012)))
sizes={'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}
import os
for k,px in sizes.items():
    os.makedirs(f"app/src/main/res/mipmap-{k}",exist_ok=True)
    S=px*4
    im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([S*0.04,S*0.04,S*0.96,S*0.96],radius=S*0.2,fill=BG)
    draw_mark(d,S/2,S/2,S*0.92)
    im.resize((px,px),Image.LANCZOS).save(f"app/src/main/res/mipmap-{k}/ic_launcher.png")
    F2=int(px*108/48)*4
    fg=Image.new("RGBA",(F2,F2),(0,0,0,0)); d=ImageDraw.Draw(fg)
    draw_mark(d,F2/2,F2/2,F2*0.62)
    fg.resize((F2//4,F2//4),Image.LANCZOS).save(f"app/src/main/res/mipmap-{k}/ic_launcher_foreground.png")
    if k=='xxxhdpi': im.resize((512,512)).save("icon-preview.png")
