// Import required modules and libraries
import puppeteer from 'puppeteer';

import { franc } from "franc"; // Used for detecting language of the review text
import fs from 'fs'; // File system module for saving data

// Use Stealth Plugin with Puppeteer to avoid detection
puppeteer.use(StealthPlugin());

// Function to scroll the page to the bottom (infinite scroll)
async function scrollToBottom(page) {
    await page.evaluate(async () => {
        while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
            window.scrollBy(0, window.innerHeight); // Scroll the page down
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before next scroll
        }
    });
}

(async () => {
    try {
        // Launch Puppeteer browser instance
        const browser = await puppeteer.launch({
            headless: false, // Set to false to see the browser
            defaultViewport: null, // Use default viewport size
        });

        // Open a new page
        const page = await browser.newPage();

        // Navigate to the target webpage (Hotel reviews page)
        await page.goto('https://www.skyscanner.co.th/hotels/thailand/ban-kammala-hotels/the-naka-phuket/ht-115499867&locale=en-US', {
            waitUntil: 'domcontentloaded', // Wait until the DOM is fully loaded
        });

        // Wait for 5 seconds to ensure the page content is loaded
        await page.waitForTimeout(5000);

        // Select the reviews section and click to load reviews
        const buttonReviewSelector = '#app-root > div.MainContent_MainContent__section__Y2FjZ.SEOPageLayout_SEOPageLayout__hotelInformation__MDMxY > div > div.DesktopLayout_DesktopLayout__reviewWrap__ZTkwZ > div > div > section';
        await page.click(buttonReviewSelector);

        // Scroll to the bottom of the page to load more reviews
        await scrollToBottom(page);

        // Variables to control retry logic
        let isButtonDisabled = false;
        let retries = 3;

        // Array to store all the quotes (reviews)
        let allQuotes = [];

        // Loop through review elements on the page
        const quotes = await page.evaluate(() => {
            const nameElement = document.querySelector('.DesktopLayout_DesktopLayout__nameStars__MGE5Y > h1');
            const hotelName = nameElement ? nameElement.textContent.trim() : null;

            const boxElement = document.querySelectorAll("div.ReviewCardItem_ReviewCardItem__YTU2Y ");
            const boxCompress = [];

            boxElement.forEach(async element => {
                // Extract review details like text, rating, and date
                const reviewEl = element.querySelector("div.ReviewCardItem_ReviewCardItem__rightSection__YzZkZ > div.ReviewCardItem_ReviewCardItem__reviewContent__OWU1N > span");
                const reviewText = reviewEl ? reviewEl.innerText.trim() : "Review not found";

                const ratingEl = element.querySelector("span.BpkText_bpk-text__ZjI3M.BpkText_bpk-text--label-1__MWI4N.BpkRating_bpk-rating__value__YzhiN");
                const ratingText = ratingEl ? ratingEl.innerText.split('/')[0].trim() : "Rating not found";

                const dateEl = element.querySelector("div.ReviewCardItem_ReviewCardItem__guestInfo__YmE1Y > p.BpkText_bpk-text__ZjI3M.BpkText_bpk-text--caption__NzU1O.ReviewCardItem_ReviewCardItem__info__YTg5Z");
                const dateText = dateEl ? formatDate(dateEl.innerText) : "Date not found";
                
                // Function to format date from Thai language to YYYY/MM/DD format
                function formatDate(dateString) {
                    const datePart = dateString.split(':')[1].trim();
                    const dateRegex = /^(\d{1,2}) (\S+) (\d{4})$/;
                    if (!dateRegex.test(datePart)) return "Invalid date format";

                    const [, day, month, year] = datePart.match(dateRegex);
                    const monthNumber = {
                        'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
                        'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
                    }[month];
                    return `${year}/${monthNumber}/${day}`;
                }

                // Push review details into the array
                boxCompress.push({
                    hotel: hotelName,
                    review: reviewText,
                    rating: ratingText.replaceAll("\n",""),
                    date: dateText,
                    reference: "Skyscanner",
                });
            });

            return boxCompress;
        });

        allQuotes = allQuotes.concat(quotes);

        // Retry logic for navigating to next page of reviews
        while (!isButtonDisabled && retries > 0) {
            try {
                const nextButtonselector = 'nav.BpkPagination_bpk-pagination__N2VhM > button:nth-child(3)';
                
                // Evaluate and collect review data
                const quotes = await page.evaluate(() => {
                    // Extract review details
                    const nameElement = document.querySelector('.DesktopLayout_DesktopLayout__nameStars__MGE5Y > h1');
                    const hotelName = nameElement ? nameElement.textContent.trim() : null;

                    const boxElement = document.querySelectorAll("div.ReviewCardItem_ReviewCardItem__YTU2Y ");
                    const boxCompress = [];

                    boxElement.forEach(async element => {
                        const reviewEl = element.querySelector("div.ReviewCardItem_ReviewCardItem__rightSection__YzZkZ > div.ReviewCardItem_ReviewCardItem__reviewContent__OWU1N > span");
                        const reviewText = reviewEl ? reviewEl.innerText.trim() : "Review not found";

                        const ratingEl = element.querySelector("span.BpkText_bpk-text__ZjI3M.BpkText_bpk-text--label-1__MWI4N.BpkRating_bpk-rating__value__YzhiN");
                        const ratingText = ratingEl ? ratingEl.innerText.split('/')[0].trim() : "Rating not found";

                        const dateEl = element.querySelector("div.ReviewCardItem_ReviewCardItem__guestInfo__YmE1Y > p.BpkText_bpk-text__ZjI3M.BpkText_bpk-text--caption__NzU1O.ReviewCardItem_ReviewCardItem__info__YTg5Z");
                        const dateText = dateEl ? formatDate(dateEl.innerText) : "Date not found";

                        boxCompress.push({
                            hotel: hotelName,
                            review: reviewText.replaceAll("\n",""),
                            rating: ratingText,
                            date: dateText,
                            reference: "Skyscanner",
                        });
                    });

                    return boxCompress;
                });

                allQuotes = allQuotes.concat(quotes);

                // Log the progress
                console.log('Data scraping complete.');
                console.log('Number of quotes:', allQuotes.length);

                // Save the scraped data to a JSON file
                const jsonString = JSON.stringify(allQuotes, null, 2);
                const path = "Skyscanner-comments.json";
                fs.writeFile(path, jsonString, (err) => {
                    if (err) {
                        console.log("Error:", err);
                        return;
                    }
                    console.log(`Data saved to ${path}`);
                });

                // Wait for the next page button to load and click it
                await page.waitForSelector(nextButtonselector, { timeout: 60000 });
                await page.click(nextButtonselector);
                await page.waitForTimeout(5000); // Wait for the page to load

                // Check if the next page button is disabled
                isButtonDisabled = await page.$eval(nextButtonselector, button => button.disabled);
                console.log('Is button disabled?', isButtonDisabled);
            } catch (error) {
                console.error('An error occurred:', error.message);
                retries--;
                if (retries <= 0) {
                    console.log('Maximum retries reached. Exiting...');
                    break;
                }
                console.log(`Retrying... (${retries} retries left)`);
                await page.waitForTimeout(10000); // Wait before retrying
            }
        }

        await browser.close(); // Close the browser

    } catch (error) {
        console.log("Error:", error);
    }
})();
