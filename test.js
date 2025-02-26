import puppeteer from 'puppeteer';


(async () => {
  try {
    //set up puppeteer browser
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
    });
    const page = await browser.newPage();
    //set where to go
    await page.goto('https://web.hungryhub.com/restaurants/see-fah-thonglor?locale=th', { 
      waitUntil: "domcontentloaded" 
    });
    //set screen size
    await page.setViewport({ 
      width: 1200, height: 800 
    });
    //wait for page to load
    await page.waitForTimeout(8000);
} catch (error) {
    console.log(error);
}

//   // Close the browser
//   await browser.close();
})();