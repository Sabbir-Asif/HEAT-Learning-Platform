import type { PublicFrontPageResponse } from "@heat/contracts";
import { AboutBanner, EmptyState, FeatureGrid, HeroBanner, PageSection } from "@heat/ui";
import {
  AwardIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import { CourseCard } from "./course-card";
import { HeroActions } from "./hero-actions";

interface LandingPageProps {
  frontPage: PublicFrontPageResponse;
}

const features = [
  {
    icon: BookOpenIcon,
    title: "Interactive learning",
    description: "Engaging modules, case studies and real-life scenarios.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Assess your learning",
    description: "Quizzes, reflections and feedback after every module.",
  },
  {
    icon: AwardIcon,
    title: "Get a certificate",
    description: "Receive a completion certificate when you finish a course.",
  },
  {
    icon: UsersIcon,
    title: "For the university community",
    description: "Designed for students, teachers and administrators.",
  },
];

export function LandingPage({ frontPage }: LandingPageProps) {
  return (
    <>
      <HeroBanner
        badge="HEAT Project (PIN 13019)"
        title="Preventing gender-based violence in university campuses"
        description="An interactive training for students, teachers and university administrators, from the Women Safety Awareness Program at the University of Dhaka."
        actions={<HeroActions />}
        image={
          <Image
            src="/hero/campus-gathering.jpg"
            alt="Four university students talking together in front of a campus building"
            fill
            priority
            unoptimized
            sizes="100vw"
          />
        }
      />
      <FeatureGrid aria-label="What you get" tiles={features} />
      <PageSection
        id="courses"
        title="Courses"
        description="Enroll in a course to start learning, or pick up where you left off."
      >
        {frontPage.courses.length === 0 ? (
          <EmptyState
            icon={GraduationCapIcon}
            title="No courses yet"
            description="Courses will appear here when they are published."
          />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {frontPage.courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        )}
      </PageSection>
      <AboutBanner
        id="about"
        title="About the Project"
        image={
          <Image
            src="/hero/campus-illustration.jpg"
            alt="Illustration of a University of Dhaka campus building between trees"
            fill
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        }
      >
        <p>
          A HEAT sub-project (PIN 13019) implemented by the Department of Women and Gender Studies,
          University of Dhaka, with the aim of developing a holistic approach to prevent
          gender-based violence in university campuses.
        </p>
      </AboutBanner>
    </>
  );
}
