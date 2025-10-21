import cv2
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance
import matplotlib.pyplot as plt
import numpy as np
import textwrap
import cv2
import glob
import datetime
import requests


class sae():

    input_file = ''
#     def input_file(self,inp):
#         self.input_file = inp
    def add_alpha(self,rgb_data):
        rgba = cv2.cvtColor(rgb_data, cv2.COLOR_RGB2RGBA)
        return (rgba)
    # Reading the Image
    def add_border(self,input_file='',output_file='', width='', color='black'):
        if input_file == '':
            input_file = sorted(glob.glob('captioned*'))[-1]

        img = Image.open(input_file)
        W,H = img.size
        if width == '':
            width = W//40
        print (W)    
        img_with_border = ImageOps.expand(img,border=width,fill=color)
        if output_file == '':
            output_file = 'imaged-with-border_'+input_file
        img_with_border.save(output_file)
#         print ()
        return (output_file)

    def get_vignet_face(self, input_arg, output_file = '',fxy=('','')):
        if  (type(input_arg) == str):
            img = cv2.imread(input_arg,1)
        elif (type(input_arg) == np.ndarray):
            img = Image.fromarray(img)
        else :
            img = input_arg

        if (fxy=='centre'):
            H,W = img.shape[:2]
            fx,fy = W//2,H//2
        elif (fxy[0] == '' or fxy[1] == ''):
            # Finding the Face 
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) 
            try :
                face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml') 
            except :
                requests.get('https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml')
                ff = open('haarcascade_frontalface_default.xml','w')
                ff.write(str(r.content.decode("utf-8")))
                ff.close()
            
            faces = face_cascade.detectMultiScale(gray, 1.3, 5) 

            try :
                x,y,w,h = faces[0]
                fx,fy = x+w//2,y+h//2
            except IndexError :
                H,W = img.shape[:2]
                fx,fy = W//2,H//2
                print ('No Face detected in the image. Keeping the focus at the centre point')

        else :
            fx,fy = fxy

        # Focus Cordinate is already put 
        rows,cols = img.shape[:2]
        sigma = min(rows,cols)//2.5 # Standard Deviation of the Gaussian

        fxn = fx - cols//2 # Normalised temperory vars
        fyn = fy - rows//2

        zeros = np.copy(img)
        zeros[:,:,:] = 0

        a = cv2.getGaussianKernel(2*cols ,sigma)[cols-fx:2*cols-fx]
        b = cv2.getGaussianKernel(2*rows ,sigma)[rows-fy:2*rows-fy]
        c = b*a.T
        d = c/c.max()
        zeros[:,:,0] = img[:,:,0]*d
        zeros[:,:,1] = img[:,:,1]*d
        zeros[:,:,2] = img[:,:,2]*d

        # zeros = add_alpha(zeros)
        if output_file == '' :
            output_file = 'vignet_out'+ str(datetime.datetime.now()) + '.png'
        cv2.imwrite(output_file,zeros)
        return (output_file)

    def put_caption(self,caption,input_file='',output_file='', caption_width=50, xy = ('',''), text_font = './fonts/PTS75F.ttf', font_size=50,font_color='rgba(255,255,255,255)',):
        wrapper = textwrap.TextWrapper(width=caption_width) 
        word_list = wrapper.wrap(text=caption)
        print (word_list)
        caption_new = ''
        if input_file == '':
            try :
                input_file = sorted(glob.glob('vignet_out*'))[-1]
            except :
                print ('Please put a valid Input File')
                return(0)
        if len(word_list) == 1:
            caption_new = word_list[0]
        elif len(word_list) == 0:
            caption_new = ' '    
        else :
            for ii in word_list[:-1]:
                caption_new = caption_new + ii + '\n'
            caption_new += word_list[-1]

        image = Image.open(input_file)
        draw = ImageDraw.Draw(image)

        font = ImageFont.truetype(text_font, size=font_size)
        if (xy[0] == '' or xy[1] == ''):
            w,h = draw.textsize(caption_new, font=font)
            W,H = image.size
            x,y = 0.5*(W-w),0.90*H-h
        else :
            x,y = xy
        draw.text((x, y), caption_new, fill=font_color, font=font)
        if output_file == '':
            output_file = 'captioned' + input_file
        image.save(output_file)
#         print('captioned' + input_file)
        return(output_file)

    def put_logo(self, input_file='',output_file='', xy = ('',''), text_font = './fonts/ChunkFive-Regular.otf', font_size='',font_color='rgba(255,255,255,255)',
                border = ('','')):

        if input_file == '':
            try :
                input_file = sorted(glob.glob('imaged-with-border*'))[-1]
            except :
                print ('Please put a valid Input File')
                return(0)
        background = Image.open(input_file)
        W,H = background.size
        if (border[0]=='' or border[1]==''):
            border = (W//40,W//40)
        if font_size == '':
            font_size = W//40
    #     background = Image.open(input_file)
    #     background = Image.fromarray(add_alpha(np.array(background)))
        draw = ImageDraw.Draw(background)
    #     from PIL import Image
        tw_img = Image.open('SM/tw.png')

        tw_img = tw_img.resize((font_size,font_size))
        img_w, img_h = tw_img.size
        # background = Image.new('RGBA', (290, 290), (0, 0, 255,0))
        bg_w, bg_h = background.size
        ht = background.size[1] - tw_img.size[1]
        offset = (border[0], ht-border[1])
        background.paste(tw_img, offset,tw_img)

        # Adding FB Logo
        tw_img = Image.open('./SM/fb.png')

        tw_img = tw_img.resize((font_size,font_size))
        img_w, img_h = tw_img.size
#         background = Image.new('RGBA', (290, 290), (0, 0, 255,0))
        bg_w, bg_h = background.size
        ht = background.size[1] - tw_img.size[1]

        logo = 'www.sae.news'
        font = ImageFont.truetype(text_font, size=font_size)
        tw_text_size,h = draw.textsize(logo, font=font)


        offset = (bg_w - border[0] - tw_text_size -tw_img.size[0] , ht-border[1])
        background.paste(tw_img, offset,tw_img)

        # Adding Text for FB
        x,y = bg_w - border[0] - tw_text_size,  ht-border[1]
        draw.text((x,y),logo,font=font)

        #
        logo = 'SouthAsianXpres'
        font = ImageFont.truetype(text_font, size=font_size)
        tw_text_size,h = draw.textsize(logo, font=font)
        x,y = border[0] + img_w,  ht-border[1]
        draw.text((x,y),logo,font=font)
        if output_file == '':
            output_file = 'final_'+input_file
        background.save(output_file)
        return (output_file)
    #     draw.text((x, y), caption_new, fill=font_color, font=font)
    #     image.save('captioned' + input_file)
    #     print('captioned' + input_file)
    #     return(image)

