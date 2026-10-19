# Events and tickets

With the **events** plugin each site can list events, take RSVPs (with a capacity and a waiting list) and sell tickets. This page is for the people who run the events. The plugin's own README is the complete reference: [`events`](https://github.com/polysites/polysite-plugins/tree/main/events).

## Make an event

**Content → Events → Create new.** Give it a title, an address (slug), a start and end, the place, a picture and a description. Like a page, an event has **Save draft** and **Publish changes**, a version history, scheduled publishing and the *ready for review* marker. See [Drafts and publishing](/guide/publishing).

Times are shown in the event's own time zone, so a visitor anywhere sees the time on the clock where the event is.

The list is at `/events` (you can change that under **Event settings**), and each event is at `/events/<slug>`.

## Take RSVPs

Under **RSVP** on the event, set a **capacity** (how many people in all), how many people one RSVP may cover, and whether a **waiting list** takes over when it is full. People who give their place back, or a bigger capacity, move the waiting list up in order, and each person who moves up gets an email.

Every RSVP gets a confirmation email with a calendar link and a link to give the place back, and everyone confirmed gets a reminder about a day before. One email address is one person: the same address can't register twice.

You can also send people to a page of your choice after they register (**Send them to**), such as a thank-you page or another system's page.

## Sell tickets

Add **Tickets** to the event (a code, a name, a price in dollars) and the RSVP form turns into a ticket form. A ticket can leave part of its price out of a tax receipt, or be a **sponsorship** (a contribution that doesn't take a seat).

Prices are worked out by the server, never by the visitor's browser. The visitor pays on the payment provider's own page, so **a card number never reaches your site**, and the places are only confirmed once the provider's records show the payment. If a payment can't be confirmed, it appears under **Content → Ticket orders** with buttons to check again, settle it by hand, or let the places go.

Which provider takes the money is set under **Event settings** (**Payment provider**). A payment provider is a separate plugin; none ships with the events plugin.

## For staff

- On an event's screen: the numbers, a link to its RSVPs, a spreadsheet download, and **Count again** if the numbers ever look wrong.
- **Content → RSVPs:** move someone between the waiting list and confirmed, add someone, or cancel.
- RSVPs hold names and email addresses, so they are **deleted a number of days after the event** (180 by default, per site).

## What it doesn't do

Recurring events, door check-in or QR codes, refunds from inside Polysite, and mixing free RSVPs with paid tickets on one event. The privacy-request register doesn't cover RSVPs yet: to erase someone, delete their RSVP by hand.
