from PIL import Image, ImageFont, ImageDraw
import cv2
from saenews.sae2 import sae2
import datetime



def title_tagline_news(title,tag_line,input_file, output_file=''):
    if output_file == '':
        output_file = str(datetime.datetime.now()) + '.png'
    a = sae2() # Do not Remove # Class Initiation
    a.input_file = input_file # Name of Input  File
    file_name = input_file.split('.')[0]
    H,W = cv2.imread(a.input_file,1).shape[:2] 
    img = Image.open(a.input_file)
    scale = (H/W)
    WW = 1440
    HH = round(WW*scale)
    W,H = WW,HH
    aa = img.resize((WW,HH)).save( '_resize.png')

    ## For the Title
    xy = (W//28,round(H/1.5))
    text_font='./fonts/OTF/Akrobat-Black.otf'
    font_size = W//25 # Font Size Enter Manually if required
    caption_width = W//25  # Width of the caption. Reduce if the text is going outside the image

    border_width = W//72 # Width of the Border
    logo_border = (W//36,W//36) # How much away from the edge should the logo appear?? Have put (Width of Image)/40. But change if required.
    font_title = ImageFont.truetype(text_font, size=font_size)
    draw = ImageDraw.Draw(img)
    w,h = draw.textsize(title, font=font_title)
    ### Do not edit below unless you know the exact working of the functionsa

    out = a.get_vignet_face('_resize.png',fxy='centre' )
    out = a.put_caption(input_file=out, caption=title,caption_width=caption_width,font_size=font_size, xy = xy, text_font=text_font)

    text_font='./fonts/PTS56F.ttf'
    font_size = W//36 # Font Size Enter Manually if required
    # xy_tagline = (xy[0], xy[1]+ font_size+10)
    xy_tagline = (xy[0], xy[1]+h*2)
    caption_width = W//18
    out = a.put_caption(input_file=out, caption=tag_line,caption_width=caption_width,font_size=font_size, xy = xy_tagline, text_font=text_font)
    out = a.add_border(width=border_width,color='red',input_file=out,  )

    out = a.put_logo(input_file=out,border=logo_border, output_file=output_file)
    return(out)
