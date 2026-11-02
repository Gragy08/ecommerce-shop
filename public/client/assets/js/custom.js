$(function () {

    "use strict";

    //======MENU FIX JS=======   
    $(window).scroll(function () {
        if ($(this).scrollTop() > 1) {
            if ($('.main_menu').offset() != undefined) {
                if (!$('.main_menu').hasClass("menu_fix")) {
                    $('.main_menu').addClass("menu_fix");
                }
            }
        }
        else {
            if ($('.main_menu').offset() != undefined) {
                $('.main_menu').removeClass("menu_fix");
            }
        }
    });

    //=====CATEGORY MENU======  
    $('.menu_category_bar').on('click', function () {
        $('.menu_category_area').toggleClass('show_category');
    });

    $('.menu_category_bar').on('click', function () {
        $('.menu_category_bar').toggleClass('ratate_arrow');
    });


    //===venobox js===
    $('.venobox').venobox();


    //=======Simply Countdown======   
    // var d = new Date(),
    //     countUpDate = new Date();
    // d.setDate(d.getDate() + 365);
    // simplyCountdown('.simply-countdown-one', {
    //     year: d.getFullYear(),
    //     month: d.getMonth() + 1,
    //     day: d.getDate(),
    //     enableUtc: true
    // });


    const simplyCountdownOne = document.querySelector('.simply-countdown-one');
    if(simplyCountdownOne) {
        const endTime = simplyCountdownOne.getAttribute("data-end-time");
        if (!endTime) return;
        const endDate = new Date(endTime);
        simplyCountdown('.simply-countdown-one', {
            year: endDate.getFullYear(),
            month: endDate.getMonth() + 1,
            day: endDate.getDate(),
            hours: endDate.getHours(),
            minutes: endDate.getMinutes(),
            seconds: endDate.getSeconds(),
            enableUtc: true
        });
    }


    //======countUp js=========   
    $('.counter').countUp();


    //=======SELECT2======== 
    $(document).ready(function () {
        $('.select_2').select2();
    });


    //======NICE SELECT=======
    $('.select_js').niceSelect();

    // selectJS
    const listSelectJS = document.querySelectorAll("[select-js]");
    if(listSelectJS.length > 0) {
        listSelectJS.forEach(selectJS => {
            const url = new URL(window.location.href);
            const feildName = selectJS.getAttribute("select-js");

            selectJS.addEventListener("click", (event) => {
                if (event.target.classList.contains("option")) {
                    const value = event.target.getAttribute("data-value");
                    if (value) {
                        url.searchParams.set(feildName, value);
                    } else {
                        url.searchParams.delete(feildName);
                    }
                    window.location.href = url.href;
                }
            });

            // Hiển thị lựa chọn mặc định
            const currentValue = url.searchParams.get(feildName);
            if (currentValue) {
                selectJS.querySelector(".show").value = currentValue;
                $('.show.select_js').niceSelect('update');
            }
        })
    }
    // End selectJS


    //=====WOW JS====== 
    new WOW().init();


    //=====BANNER SLIDER===== 
    $('.banner_slider').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 3000,
        dots: true,
        arrows: false,
        fade: true,

        responsive: [
            {
                breakpoint: 576,
                settings: {
                    dots: false
                }
            }
        ]
    });


    //=====CATEGORY SLIDER===== 
    $('.category_slider').slick({
        slidesToShow: 6,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 2500,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-arrow-right nextArrow"></i>',
        prevArrow: '<i class="far fa-arrow-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 5,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 3,
                    // arrows: false
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });

    //=====FLASH SELL SLIDER===== 
    $('.flash_sell_slider').slick({
        slidesToShow: 4,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 3000,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-arrow-right nextArrow"></i>',
        prevArrow: '<i class="far fa-arrow-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                    arrows: false
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });


    //=====MARQUEE SLIDER===== 
    $('.brand_marquee').marquee({
        speed: 70,
        gap: 0,
        delayBeforeStart: 0,
        direction: 'left',
        duplicated: true,
        pauseOnHover: true
    });

    //======TRENDING PRODUCT FILTER========== 
    $('.product_tabs').pwstabs({
        effect: 'slidedown',
        defaultTab: 1,
    });

    //=====BANNER SLIDER===== 
    $('.banner_2_slider').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        dots: true,
        arrows: false,
        fade: true,
    });

    //=====FLASH SELL 2 SLIDER===== 
    $('.flash_sell_2_slider').slick({
        slidesToShow: 5,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 2500,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-arrow-right nextArrow"></i>',
        prevArrow: '<i class="far fa-arrow-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1600,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 1400,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                    arrows: false
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });

    //=====CATEGORY SLIDER===== 
    $('.category_2_slider').slick({
        slidesToShow: 8,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 2500,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-arrow-right nextArrow"></i>',
        prevArrow: '<i class="far fa-arrow-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1600,
                settings: {
                    slidesToShow: 7,
                }
            },
            {
                breakpoint: 1400,
                settings: {
                    slidesToShow: 6,
                }
            },
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 5,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });


    //=====FAVOURITE PRODUCT 2 SLIDER===== 
    $('.favourite_product_2_slider').slick({
        slidesToShow: 4,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 2500,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-arrow-right nextArrow"></i>',
        prevArrow: '<i class="far fa-arrow-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1600,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 1400,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                    arrows: false,
                }
            }
        ]
    });


    //=====GROCERY BEST SELL SLIDER====== 
    $('.grocery_best_sell_slider').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 4000,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-arrow-right nextArrow"></i>',
        prevArrow: '<i class="far fa-arrow-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });


    //=====TESTIMONIAL SLIDER====== 
    $('.testi_slider').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 4000,
        dots: true,
        arrows: false,

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 1,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 1,
                }
            }
        ]
    });


    //=====BEAUTI BANNER SLIDER===== 
    $('.beauty_banner_slider_large').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        arrows: false,
        dots: false,
        fade: true,
        asNavFor: '.beauty_banner_slider_small'
    });

    $('.beauty_banner_slider_small').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        asNavFor: '.beauty_banner_slider_large',
        autoplay: true,
        autoplaySpeed: 3000,
        dots: false,
        arrows: false,
        centerMode: true,
        centerPadding: '0px',
        focusOnSelect: true,
        vertical: true,

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 3,
                }
            }
        ]
    });


    //=====BEAUTY FEATURED SLIDER=====
    $('.beauty_featured_slider').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-angle-right nextArrow"></i>',
        prevArrow: '<i class="far fa-angle-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });


    //=====BEAUTY CATEGORY SLIDER=====
    $('.beauty_category_slider').slick({
        slidesToShow: 7,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 3000,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-angle-right nextArrow"></i>',
        prevArrow: '<i class="far fa-angle-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1600,
                settings: {
                    slidesToShow: 6,
                }
            },
            {
                breakpoint: 1400,
                settings: {
                    slidesToShow: 5,
                }
            },
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                    arrows: false,
                }
            }
        ]
    });


    //======BEAUTY INSTAGRAM SLIDER======
    $('.beauty_instagram_slider').slick({
        slidesToShow: 8,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        dots: false,
        arrows: false,

        responsive: [
            {
                breakpoint: 1600,
                settings: {
                    slidesToShow: 7,
                }
            },
            {
                breakpoint: 1400,
                settings: {
                    slidesToShow: 6,
                }
            },
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 5,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 2,
                }
            }
        ]
    });


    //=====BEAUTY BRAND SLIDER=====
    $('.beauty_brand_slider').slick({
        slidesToShow: 6,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 3000,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-angle-right nextArrow"></i>',
        prevArrow: '<i class="far fa-angle-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 5,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 4,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 3,
                }
            }
        ]
    });


    //=====TESTIMONIAL 2 SLIDER====== 
    $('.testi_slider_2').slick({
        slidesToShow: 2,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        dots: false,
        arrows: true,
        nextArrow: '<i class="far fa-angle-right nextArrow"></i>',
        prevArrow: '<i class="far fa-angle-left prevArrow"></i>',

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 1,
                }
            },
            {
                breakpoint: 992,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 1,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 1,
                }
            }
        ]
    });


    //======STICKY SIDEBAR====== 
    $("#sticky_sidebar").stickit({
        top: 70,
        screenMinWidth: 992,
    });
    $("#sticky_sidebar_2").stickit({
        top: 70,
        screenMinWidth: 1400,
    });


    //=====RANGE SLIDER===== 
    $('.basic').alRangeSlider();
    
    // range_slider
    const rangeSlider = document.querySelector(".range_slider");
    if(rangeSlider) {
        const url = new URL(window.location.href);

        // Hiển thị giá trị mặc định
        const initialSelectedValues = {
            from: 0, 
            to: 50000000
        };
        const valueCurrent = url.searchParams.get("price");
        if(valueCurrent) {
            const [from, to] = valueCurrent.split("-");
            initialSelectedValues.from = from;
            initialSelectedValues.to = to;
        }

        const options = {
            range: {
                min: 0, 
                max: 50000000, // 50 triệu
                step: 10000 // bước nhảy 10.000đ
            },
            initialSelectedValues: initialSelectedValues,
            prettify: (number) => {
                return parseInt(number).toLocaleString("vi-VN") + "đ";
            },
            onFinish: (values) => {
                const from = values.selectedValues.from;
                const to = values.selectedValues.to;
                const value = `${from}-${to}`;
                if(value) {
                    url.searchParams.set("price", value);
                } else {
                    url.searchParams.delete("price");
                }
                window.location.href = url.href;
            }
        };

        $('.range_slider').alRangeSlider(options);
    }
    // End range_slider
    
    const options2 = {
        orientation: "vertical"
    };


    //======PRODUCT FILTER====== 
    $(".shop_filter_btn").on("click", function () {
        $(".shop_filter_btn").toggleClass("show");
    });
    $(".shop_filter_btn").on("click", function () {
        $(".shop_filter_area").toggleClass("show");
    });


    //======PRODUCT DETAILS SLIDER====== 
    $('.details_slider_thumb').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: false,
        vertical: true,
        asNavFor: '.details_slider_nav',
    });
    $('.details_slider_nav').slick({
        slidesToShow: 5,
        slidesToScroll: 1,
        asNavFor: '.details_slider_thumb',
        autoplay: false,
        autoplaySpeed: 3000,
        dots: false,
        arrows: false,
        centerMode: true,
        centerPadding: '0',
        focusOnSelect: true,
        vertical: true,

        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 5,
                    vertical: false,
                }
            },
            {
                breakpoint: 576,
                settings: {
                    slidesToShow: 3,
                    vertical: false,
                }
            }
        ]
    });


    //=====RATING JS=====
    const stars = document.querySelectorAll(".select_rating i");

    stars.forEach((star, index1) => {
        star.addEventListener("click", () => {
            stars.forEach((star, index2) => {
                index1 >= index2 ? star.classList.add("active") : star.classList.remove("active");
            });
        });
    });


    //=====MOBILE MENU TOGGLER=====
    const mobile_menu = document.querySelectorAll(".mobile_dropdown");
    mobile_menu.forEach((dropdown) => {
        const innerMenu = dropdown.querySelector(".inner_menu");
        dropdown.addEventListener("click", () => {
            if (innerMenu.style.maxHeight) {
                innerMenu.style.maxHeight = null;
                dropdown.classList.remove("active");
            } else {
                mobile_menu.forEach((item) => {
                    const menu = item.querySelector(".inner_menu");
                    if (menu !== innerMenu) {
                        menu.style.maxHeight = null;
                        item.classList.remove("active");
                    }
                });
                innerMenu.style.maxHeight = innerMenu.scrollHeight + "px";
                dropdown.classList.add("active");
            }
        });
    });

    //=====REVIEW IMAGE UPLOAD=====
    $('.gallery').miv({ image: '.cam', video: '.vid' });


});