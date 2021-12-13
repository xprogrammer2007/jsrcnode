const puppeteer = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')
var express = require('express')
var app = express()


const axios = require('axios')
const https = require('https')

function rdn(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

async function solve(page,res) {
  try {
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe[src*="api2/anchor"]')
      if (!iframe) return false

      return !!iframe.contentWindow.document.querySelector('#recaptcha-anchor')
    })

    let frames = await page.frames()
    const recaptchaFrame = frames.find(frame => frame.url().includes('api2/anchor'))

    const checkbox = await recaptchaFrame.$('#recaptcha-anchor')
    await checkbox.click({ delay: rdn(30, 150) })

    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe[src*="api2/bframe"]')
      if (!iframe) return false

      const img = iframe.contentWindow.document.querySelector('.rc-image-tile-wrapper img')
      return img && img.complete
    })

    frames = await page.frames()
    const imageFrame = frames.find(frame => frame.url().includes('api2/bframe'))
    const audioButton = await imageFrame.$('#recaptcha-audio-button')
    await audioButton.click({ delay: rdn(30, 150) })

    while (true) {

        await page.waitForFunction(() => {
          const iframe = document.querySelector('iframe[src*="api2/bframe"]')
          if (!iframe) return false

          return !!iframe.contentWindow.document.querySelector('.rc-audiochallenge-tdownload-link')
        }, { timeout: 3000 })
       
      const audioLink = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="api2/bframe"]')
        return iframe.contentWindow.document.querySelector('#audio-source').src
      })


      const audioBytes = await page.evaluate(audioLink => {
        return (async () => {
          const response = await window.fetch(audioLink)
          const buffer = await response.arrayBuffer()
          return Array.from(new Uint8Array(buffer))
        })()
      }, audioLink)

      const httsAgent = new https.Agent({ rejectUnauthorized: false })
      const response = await axios({
        httsAgent,
        method: 'post',
        url: 'https://api.wit.ai/speech',
        data: new Uint8Array(audioBytes).buffer,
        headers: {
          Authorization: 'Bearer JVHWCNWJLWLGN6MFALYLHAPKUFHMNTAC',
          'Content-Type': 'audio/mpeg3'
        }
      })

      if (undefined == response.data.text) {
        const reloadButton = await imageFrame.$('#recaptcha-reload-button')
        await reloadButton.click({ delay: rdn(30, 150) })
        continue
      }

      const audioTranscript = response.data.text.trim()
      const input = await imageFrame.$('#audio-response')
      await input.click({ delay: rdn(30, 150) })
      await input.type(audioTranscript, { delay: rdn(30, 75) })

      const verifyButton = await imageFrame.$('#recaptcha-verify-button')
      await verifyButton.click({ delay: rdn(30, 150) })


      try {
        await page.waitForFunction(() => {
          const iframe = document.querySelector('iframe[src*="api2/anchor"]')
          if (!iframe) return false

          return !!iframe.contentWindow.document.querySelector('#recaptcha-anchor[aria-checked="true"]')
        }, { timeout: 3000 })

        const token = await page.evaluate(() => {
                return document.querySelector('[title="recaptcha challenge"]').contentWindow.document.getElementById("recaptcha-token").value;
            })
        
	    res.json({"g-recaptcha-response":token});

        
        return page.evaluate(() => document.getElementById('g-recaptcha-response').value)
      } catch (e) {
        continue
      }
    }
  } catch (e) {
    res.json({"error":"true","massege":"try again later"});
    return null
  }

}


async function run (url,res) {
  puppeteer.use(pluginStealth())

  const browser1 = await puppeteer.launch({
    headless: true,
    args: ['--window-size=360,500', '--window-position=000,000', '--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=IsolateOrigins', ' --disable-site-isolation-trials']
  })


  const page1 = await browser1.newPage()


  await page1.setDefaultNavigationTimeout(0)


  page1.goto(url)
  solve(page1,res)
  

}



app.get('/bypass', function (req, res) {
	res.setHeader('Content-Type', 'application/json');
	run(req.query.url,res)
})

// POST method route
app.get('/', function (req, res) {
  res.send('get out of my face')
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`App listening on port ${port}`))

